/**
 * C-32 — limit set viewer with the ping-pong convex domain ℙ(K).
 *
 * Two layers share one ℝ³ chart and camera:
 *   • the limit set Λ  — instanced spheres (proximal basepoint → BFS orbit).
 *   • the domain ℙ(K)  — the cone's projected 1-skeleton (wireframe) and/or its
 *                        translucent silhouette body. A copy that crosses the
 *                        hyperplane at infinity is drawn as the TWO halves it
 *                        really is, running off to opposite sides.
 *
 * Coordinate pipeline (the "Coordinates" folder), applied to every point:
 *   1. compute in the companion basis (the repo's A₀,B₀);
 *   2. transform to a coordinate system  z = M·x  (companion M=I, u-basis M=P⁻¹);
 *   3. choose an affine patch (denominator zᵢ);
 *   4. choose the ℝ⁵→ℝ³ map (a coordinate triple).
 * Stages 2–4 collapse into one ChartEmbedding whose denom + rows are selected
 * rows of M (`c32Chart`). No PCA — explicit coordinate projections only.
 *
 * Thin wiring. The coordinate systems, the copy presets, the cone and its
 * facets/edges are the `c32-domain` / `c32-cone` examples; the drawing is
 * core/convex + app/convexMesh. "save view" exports the framing to
 * outputs/presets/c32-view-preset.json for scripts/render/c32-render-limit-set.ts.
 * See README.md for the math and module map.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { ControlPanel } from '@/app/ControlPanel';
import { createSphereMaterial, makeInstancedSpheres } from '@/app/instancedSpheres';
import { autofitCamera } from '@/app/autofit';

import {
  exampleById, symplecticAction, seedSymplectic, type SymplecticExample,
} from '@/examples/hypergeometric/degree6-symplectic';
import { validateSymplecticExample } from '@/examples/hypergeometric/validate';
import { paletteForSymplectic as paletteForScheme } from '@/examples/hypergeometric/palette';
import type { GroupAction } from '@/core/group';
import { generateOrbit, type Orbit } from '@/core/orbit';
import type { ChartEmbedding } from '@/core/chart';
import { schemeForColorDepth } from '@/render/colorScheme.ts';
import { buildOrbitInstances } from '@/render/orbitInstances.ts';
import {
  COORD_SYSTEMS, baseCopies, c32Chart, coneBoundedInChart, copiesFor, copyChartPieces,
  copyClipExtent, copyCone, copiesWithPieces, DEFAULT_AXES, DEFAULT_COORD, DEFAULT_DENOM,
  type Copy, type CopyMode, type CopyPieces,
} from '@/examples/hypergeometric/c32-domain';
import { identity } from '@/core/matrix';
import { c32Cone } from '@/examples/hypergeometric/c32-cone';
import { embedRays } from '@/core/convexChart';
import type { ConvexCone } from '@/core/convex';
import { coneDomainMesh, coneMembershipInstances, hexToRgb } from '@/app/convexMesh';
import { cameraSpecFromApp, viewportFromApp, saveViewPreset } from '@/app/viewExport';
import type { C32ViewPreset } from '@/examples/hypergeometric/viewPreset';

// ─── This demo is C-32, period ───────────────────────────────────────────────

const C32: SymplecticExample = exampleById('c32');
{
  const v = validateSymplecticExample(C32);
  if (!v.passed) throw new Error(`[c32] validation failed: ${v.errors.join('; ')}`);
  for (const w of v.warnings) console.warn(`[c32] ⚠ ${w}`);
}

const DEFAULT_DEPTH  = 12;
const DEFAULT_RADIUS = 0.025;

// Domain ℙ(K) defaults + styling (per-copy colors live in copies.ts).
const DEFAULT_SHOW_INTERIOR = false;     // open on the silhouette shell (3D-hull boundary only)
const DOMAIN_DEFAULT_SIZE   = 0.006;     // edge-tube radius
const VERTEX_SCALE          = 1.8;       // vertexRadius / tubeRadius
const BODY_OPACITY          = 0.10;
// How far past the visible geometry a half that runs off to infinity is cut.
// The offline renderer frames Λ together with the bounded copies and wants this
// large, so the cut lands off-picture; the viewer frames Λ alone, so a large
// value puts the camera INSIDE the halves. Hence a modest default and a slider.
const CLIP_MULTIPLE_DEFAULT = 4;

// ─── Scene + state ────────────────────────────────────────────────────────────

const app = new App({ antialias: true });
app.scene.background = new THREE.Color(0xf2f2f2);

const { material, uniforms } = createSphereMaterial();
const action: GroupAction = symplecticAction(C32);

let basepoint!: Float64Array;
let currentSeedName = 'TBT';
let orbit!: Orbit;
let mesh: THREE.Mesh | null = null;
let depth = DEFAULT_DEPTH;
let stats = { kept: 0, totalWords: 0 };

// Coordinate-pipeline state (the "Coordinates" folder drives these).
let coordId = DEFAULT_COORD;
let denomIdx = DEFAULT_DENOM;
let axes: [number, number, number] = [...DEFAULT_AXES];
let proj: ChartEmbedding = c32Chart(coordId, denomIdx, axes);

function applyChart(): void { proj = c32Chart(coordId, denomIdx, axes); }

// Domain state. The base cone K (rays + its 33 facets + 680-edge 1-skeleton, all
// computed by core/convex) is built once; `copyCone(g)` carries a copy g·K into
// COMPANION coords so it projects through the same chart as the orbit.
const BASE_CONE = c32Cone();
// How to show the copies: as 3-D hulls (wire/body) OR as a coloring of Λ by cone
// membership. 'coloring' draws no hulls and recolors the limit set instead.
type DomainMode = 'none' | 'wire' | 'wire+body' | 'body' | 'coloring';
let domainMode: DomainMode = 'wire+body';
let copyMode: CopyMode = 'base';
let domainSize = DOMAIN_DEFAULT_SIZE;
let showInterior = DEFAULT_SHOW_INTERIOR;   // false ⇒ only the 3D-hull boundary
// Which edges the wireframe draws (matches the offline renderer's --wire):
//   'hull'     — edges of the projected shadow's 3-D convex hull (clean outline)
//   'skeleton' — the faithful 1-skeleton of ℙ(K) projected (all polytope edges,
//                including ones interior in this projection)
type EdgeSet = 'hull' | 'skeleton';
let edgeSet: EdgeSet = 'hull';
// Overlay the original containing K (faint) behind the rotated/nested images.
let showContainer = false;
let activeCopies: { copy: Copy; cone: ConvexCone }[] = [];
// A copy that crosses the hyperplane at infinity has no bounded picture — but it
// does have TWO halves running off opposite sides. `splitAtInfinity` draws them
// (truncated well outside the frame); with it off, such a copy is skipped, which
// is what this viewer used to do.
let splitAtInfinity = true;
let clipMultiple = CLIP_MULTIPLE_DEFAULT;
let currentExtent = 0;   // the chart-units half-width the pieces were cut at
let activePieces: CopyPieces[] = [];
let domainObjs: { group: THREE.Group; dispose(): void }[] = [];
let domainNote: { text(s: string): void } | null = null;
// Δ₀ dominance box: in the u-basis e₀ chart, dominance (y₀ > |yᵢ|) is exactly
// |out coord| < 1, so Δ₀ projects to the cube [−1,1]³ regardless of axes. ℙ(K)
// must sit inside it (the certificate's dominance check). Only meaningful here.
let showBox = false;
let boxObj: THREE.LineSegments | null = null;
let boxNote: { text(s: string): void } | null = null;
const showWire = (): boolean => domainMode === 'wire' || domainMode === 'wire+body';
const showBody = (): boolean => domainMode === 'body' || domainMode === 'wire+body';
const coloring = (): boolean => domainMode === 'coloring';

/** Rebuild each active copy's drawable cone (companion coords + carried facets).
 *  Chart-independent, so this only follows the copy-mode. Membership coloring
 *  tests against these full cones, never against a truncated piece. */
function rebuildCopyRays(): void {
  activeCopies = copiesFor(copyMode).map((copy) => ({ copy, cone: copyCone(copy.g) }));
}

/** Rebuild the drawable PIECES for the current chart. Chart-dependent, and the
 *  split is exact double description in ℝ⁶ (~150 ms per crossing copy), so
 *  `copiesWithPieces` caches on (mode, chart, extent). */
function rebuildPieces(): void {
  if (!splitAtInfinity) { activePieces = []; return; }
  currentExtent = copyClipExtent(copyMode, proj, clipMultiple);
  activePieces = copiesWithPieces(copyMode, proj, currentExtent);
}

{
  const s = seedSymplectic(action);
  basepoint = s.basepoint;
  currentSeedName = s.name;
  console.log(
    `[c32] loaded: γ = ${s.name}, |λ_max| ≈ ${s.lambdaMax.toFixed(3)}, drift = ${s.drift.toFixed(4)}`,
  );
}

function regenerateOrbit(N: number): void {
  const t0 = performance.now();
  orbit = generateOrbit(action, basepoint, N);
  console.log(`[c32] BFS depth=${N}  words=${orbit.count}  (${(performance.now() - t0).toFixed(0)}ms)`);
}

function rebuildMesh(autofit: boolean): void {
  // 'coloring' mode tints Λ by cone membership; otherwise a plain grayscale pass.
  let aPos: Float32Array, aColor: Float32Array, kept: number;
  if (coloring() && activeCopies.length) {
    const cones = activeCopies.map((c) => ({ cone: c.cone, rgb: hexToRgb(c.copy.edge) }));
    ({ aPos, aColor, kept } = coneMembershipInstances(proj, orbit, cones));
  } else {
    const scheme = schemeForColorDepth(0);
    ({ aPos, aColor, kept } = buildOrbitInstances(proj, orbit, scheme, paletteForScheme(scheme.name)));
  }

  const next = makeInstancedSpheres(material, aPos, aColor);
  if (mesh) { app.scene.remove(mesh); mesh.geometry.dispose(); }
  app.scene.add(next);
  mesh = next;

  if (autofit) autofitCamera(app, aPos, kept);
  stats = { kept, totalWords: orbit.count };
}

// ─── Domain layer: copies of ℙ(K) ────────────────────────────────────────────

function clearDomains(): void {
  for (const o of domainObjs) { app.scene.remove(o.group); o.dispose(); }
  domainObjs = [];
}

/** Draw one copy's cone (wireframe and/or silhouette body) in its colors. The
 *  generic convex-mesh builder projects through the active chart, computes the
 *  silhouette, and hides interior wireframe vertices unless `showInterior`. */
// Counts pieces whose shadow fills the whole truncation box, so that dropping
// the lids leaves nothing: the projection has collapsed them completely.
let collapsed = 0;
// A `faint` copy (the outer containing K, when overlaid on its images) is drawn
// in light gray with a thinner wire and a paler body, so it reads as the
// container behind the copies rather than competing with them.
const FAINT_COLOR = 0x9aa4ae;

function drawCopy(
  copy: Copy, cone: ConvexCone, hullEdges = false, clipExtent?: number, faint = false,
): void {
  const edgeColor = faint ? FAINT_COLOR : copy.edge;
  const d = coneDomainMesh(cone, proj, {
    edgeColor, tubeRadius: domainSize * (faint ? 0.6 : 1),
    vertexColor: faint ? FAINT_COLOR : copy.vertex,
    vertexRadius: domainSize * VERTEX_SCALE * (faint ? 0.6 : 1),
    bodyColor: faint ? FAINT_COLOR : copy.body,
    bodyOpacity: BODY_OPACITY * (faint ? 0.5 : 1),
  }, {
    showVertices: showWire(), showEdges: showWire(), showBody: showBody(),
    showInterior, hullEdges, clipExtent,
  });
  if (d.allLids) collapsed++;
  app.scene.add(d.group);
  domainObjs.push(d);
}

/** Draw the original containing K faintly behind the copies. Split-aware, so it
 *  runs off to infinity as two halves in charts where K is unbounded. No-op when
 *  the active copies already are K. */
function drawContainerK(): void {
  if (copyMode === 'base') return;
  const kCone = copyCone(identity(6));
  if (splitAtInfinity) {
    const kExtent = copyClipExtent('base', proj, clipMultiple);
    for (const piece of copyChartPieces(identity(6), proj, kExtent)) {
      if (!piece.clipped) drawCopy(K_COPY, kCone, edgeSet === 'hull', undefined, true);
      else drawCopy(K_COPY, { rays: piece.rays, facets: [], edges: [], dim: 6 }, true, kExtent, true);
    }
  } else if (coneBoundedInChart(kCone, proj)) {
    drawCopy(K_COPY, kCone, edgeSet === 'hull', undefined, true);
  }
}
const K_COPY: Copy = baseCopies()[0];

function rebuildDomains(): void {
  clearDomains();
  if (domainMode === 'none') { domainNote?.text(''); return; }
  if (coloring()) {
    const n = activeCopies.length;
    domainNote?.text(`coloring Λ by membership in ${n} cone${n > 1 ? 's' : ''}`);
    return;   // the coloring lives in the mesh (rebuildMesh), no hulls drawn
  }

  const total = activeCopies.length;
  let drawn = 0, split = 0, skipped = 0;
  collapsed = 0;

  if (showContainer) drawContainerK();

  if (splitAtInfinity) {
    activePieces.forEach(({ copy, pieces }, k) => {
      if (pieces.length === 0) { skipped++; return; }
      if (pieces.some((p) => p.clipped)) split++;
      for (const piece of pieces) {
        if (!piece.clipped) {
          // Bounded here: this "piece" IS the whole copy, so draw the real cone —
          // whose wireframe honours the edge-set choice (hull outline vs the full
          // 1-skeleton).
          drawCopy(copy, activeCopies[k].cone, edgeSet === 'hull');
          continue;
        }
        // A truncated half is a different polytope from the cone it came out of,
        // so its wireframe has to come from the projected hull instead. Passing
        // the extent also opens the body where the cut is, so the half runs off
        // rather than ending at a lid.
        drawCopy(copy, { rays: piece.rays, facets: [], edges: [], dim: 6 },
          true, currentExtent);
      }
      drawn++;
    });
  } else {
    for (const { copy, cone } of activeCopies) {
      if (!coneBoundedInChart(cone, proj)) { skipped++; continue; }
      drawCopy(copy, cone, edgeSet === 'hull');
      drawn++;
    }
  }

  if (drawn === 0) {
    domainNote?.text('⚠ nothing drawable in this patch (crosses infinity)');
  } else if (collapsed > 0 && collapsed >= drawn) {
    domainNote?.text('shadow fills the truncation box in this projection — try other view axes');
  } else if (total === 1) {
    domainNote?.text(split
      ? 'ℙ(K) crosses infinity here — drawn as two halves'
      : `ℙ(K): ${BASE_CONE.rays.length} vertices, ${BASE_CONE.edges.length} edges` +
        (showInterior ? '' : ' (silhouette shell)'));
  } else {
    domainNote?.text(`${drawn}/${total} copies drawn` +
      (split ? `, ${split} split into halves at infinity` : '') +
      (skipped ? ` (${skipped} unbounded in this patch)` : ''));
  }
}

/**
 * Frame the camera on the DOMAIN rather than on Λ.
 *
 * The default autofit is a percentile bbox of the limit set, and a domain — a
 * half running off to infinity above all — is far larger, so it lands outside
 * that frame. Λ cannot be used to find it either: a few hundred domain corners
 * never move a percentile taken over a million orbit points. So this fits on the
 * domain's own points, which is what "see what the render will show" needs.
 */
function fitToDomain(): void {
  const pts: number[] = [];
  // Corners sitting on the cut are the rim of the opening, at a distance the
  // slider sets rather than one the geometry does. Framing on them would frame
  // the truncation box; framing on what is left frames the domain's own shape,
  // with the halves then running off past the edges.
  const tol = 1e-3 * currentExtent;
  const onCut = (p: readonly number[]): boolean =>
    Math.abs(Math.abs(p[0]) - currentExtent) < tol
    || Math.abs(Math.abs(p[1]) - currentExtent) < tol
    || Math.abs(Math.abs(p[2]) - currentExtent) < tol;
  const take = (rays: readonly (readonly number[])[], clipped: boolean): void => {
    for (const p of embedRays(rays, proj)) if (p && !(clipped && onCut(p))) pts.push(p[0], p[1], p[2]);
  };
  if (splitAtInfinity) {
    for (const { pieces } of activePieces) for (const piece of pieces) take(piece.rays, piece.clipped);
  } else {
    for (const { cone } of activeCopies) if (coneBoundedInChart(cone, proj)) take(cone.rays, false);
  }
  if (pts.length < 3) { domainNote?.text('nothing to frame in this patch'); return; }
  autofitCamera(app, new Float32Array(pts), pts.length / 3);
}

/** The Δ₀ dominance box — the cube [−1,1]³, valid only in the u-basis e₀ chart. */
function rebuildBox(): void {
  if (boxObj) {
    app.scene.remove(boxObj);
    boxObj.geometry.dispose();
    (boxObj.material as THREE.Material).dispose();
    boxObj = null;
  }
  if (!showBox) { boxNote?.text(''); return; }
  if (coordId !== 'u' || denomIdx !== 0) {
    boxNote?.text('Δ₀ box needs u-basis + patch z₁');
    return;
  }
  const cube = new THREE.BoxGeometry(2, 2, 2);
  const edges = new THREE.EdgesGeometry(cube);
  cube.dispose();
  boxObj = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x555555 }));
  app.scene.add(boxObj);
  boxNote?.text('Δ₀ dominance box: |yᵢ| < 1');
}

/** Rebuild both layers after a chart change (re-frame on Λ). Pieces come first:
 *  they depend on the chart, and the domain layer draws them. */
function rebuildAll(autofit: boolean): void {
  rebuildMesh(autofit);
  rebuildPieces();
  rebuildDomains();
  rebuildBox();
}

// ─── HUD ──────────────────────────────────────────────────────────────────────

const panel = new ControlPanel({ title: 'C-32 — limit set' });
const exMeta = panel.text({ variant: 'meta' });

panel.separator();

// ─── Coordinates folder (stages 2+3+4) ───────────────────────────────────────

const coordsFolder = panel.folder('Coordinates', { open: true });

const COORD_LABEL = ['z1', 'z2', 'z3', 'z4', 'z5', 'z6'];

// The C(5,3) view-axis triples available after fixing the denominator: choose 3
// of the 5 non-denominator coordinates (ascending → X, Y, Z).
function availableTriples(denom: number): [number, number, number][] {
  const c = [0, 1, 2, 3, 4, 5].filter((i) => i !== denom);
  const out: [number, number, number][] = [];
  for (let a = 0; a < c.length; a++)
    for (let b = a + 1; b < c.length; b++)
      for (let d = b + 1; d < c.length; d++) out.push([c[a], c[b], c[d]]);
  return out;
}
const tripleVal = (t: readonly number[]): string => t.join(',');
const tripleLabel = (t: readonly number[]): string =>
  `(z${t[0] + 1}, z${t[1] + 1}, z${t[2] + 1})`;

const selCoord = coordsFolder.select({
  label: 'coordinate system',
  options: COORD_SYSTEMS.map((c) => ({ value: c.id, label: c.label })),
  value: coordId,
  onChange: (v) => { coordId = v; applyChart(); rebuildAll(true); updateUI(); },
});

const selPatch = coordsFolder.select({
  label: 'affine patch (denominator)',
  options: COORD_LABEL.map((l, i) => ({ value: String(i), label: `${l} = 1` })),
  value: String(denomIdx),
  onChange: (v) => {
    denomIdx = parseInt(v, 10);
    populateAxes();   // available triples depend on the denominator
    applyChart(); rebuildAll(true); updateUI();
  },
});

const selAxis = coordsFolder.select({
  label: 'view axes (ℝ⁵→ℝ³)',
  options: availableTriples(denomIdx).map((t) => ({ value: tripleVal(t), label: tripleLabel(t) })),
  value: tripleVal(axes),
  onChange: (v) => {
    axes = v.split(',').map((s) => parseInt(s, 10)) as [number, number, number];
    applyChart(); rebuildAll(true); updateUI();
  },
});

/** Repopulate the view-axis dropdown with the C(5,3) triples of the current
 *  non-denominator coordinates. Keeps the current triple if still valid. */
function populateAxes(): void {
  const triples = availableTriples(denomIdx);
  if (axes.includes(denomIdx)) axes = [...triples[0]];
  const el = selAxis.element;
  el.innerHTML = '';
  for (const t of triples) {
    const o = document.createElement('option');
    o.value = tripleVal(t);
    o.textContent = tripleLabel(t);
    el.appendChild(o);
  }
  el.value = tripleVal(axes);
}

panel.separator();

// ─── Domains folder (convex ping-pong domain ℙ(K)) ───────────────────────────

const domainsFolder = panel.folder('Domains', { open: true });

const selDomain = domainsFolder.select({
  label: 'show ℙ(K) as',
  options: [
    { value: 'none', label: 'none' },
    { value: 'wire', label: 'wireframe (rays + edges)' },
    { value: 'wire+body', label: 'wireframe + body' },
    { value: 'body', label: 'body only (silhouette)' },
    { value: 'coloring', label: 'coloring (cone membership)' },
  ],
  value: domainMode,
  onChange: (v) => { domainMode = v as DomainMode; rebuildMesh(false); rebuildDomains(); updateUI(); },
});

const selCopies = domainsFolder.select({
  label: 'copies',
  options: [
    { value: 'base', label: 'K (base)' },
    { value: 'rotated', label: 'rotated S·K (×6)' },
    { value: 'nested', label: 'nested T⁻¹S·K (×6)' },
  ],
  value: copyMode,
  onChange: (v) => {
    copyMode = v as CopyMode;
    rebuildCopyRays(); rebuildPieces(); rebuildMesh(false); rebuildDomains(); updateUI();
  },
});

const selSplit = domainsFolder.select({
  label: 'copies crossing infinity',
  options: [
    { value: 'split', label: 'draw as two halves' },
    { value: 'skip', label: 'skip (bounded copies only)' },
  ],
  value: splitAtInfinity ? 'split' : 'skip',
  onChange: (v) => {
    splitAtInfinity = v === 'split';
    rebuildPieces(); rebuildDomains(); updateUI();
  },
});

const selEdges = domainsFolder.select({
  label: 'wireframe edges',
  options: [
    { value: 'hull', label: '3-D hull boundary' },
    { value: 'skeleton', label: 'full 1-skeleton (all edges)' },
  ],
  value: edgeSet,
  onChange: (v) => { edgeSet = v as EdgeSet; rebuildDomains(); },
});

const selContainer = domainsFolder.select({
  label: 'containing K',
  options: [
    { value: 'off', label: 'off' },
    { value: 'on', label: 'on (faint outer domain)' },
  ],
  value: showContainer ? 'on' : 'off',
  onChange: (v) => { showContainer = v === 'on'; rebuildDomains(); updateUI(); },
});

domainsFolder.button({
  label: 'frame the domain',
  onClick: fitToDomain,
});

const slClip = domainsFolder.slider({
  label: 'truncate halves at',
  min: 1.5, max: 40, step: 0.5, value: clipMultiple,
  format: (v) => `${v}×`,
  onChange: (v) => { clipMultiple = v; rebuildPieces(); rebuildDomains(); },
});

const selInterior = domainsFolder.select({
  label: 'interior vertices',
  options: [
    { value: 'show', label: 'show (full skeleton)' },
    { value: 'hide', label: 'hide (silhouette shell)' },
  ],
  value: showInterior ? 'show' : 'hide',
  onChange: (v) => { showInterior = v === 'show'; rebuildDomains(); },
});

const slDomainSize = domainsFolder.slider({
  label: 'wireframe size',
  min: 0.002, max: 0.05, step: 0.001, value: domainSize,
  format: (v) => v.toFixed(3),
  onChange: (v) => { domainSize = v; rebuildDomains(); },
});

domainNote = domainsFolder.text({ variant: 'meta' });

const selBox = domainsFolder.select({
  label: 'Δ₀ dominance box',
  options: [
    { value: 'off', label: 'off' },
    { value: 'on', label: 'on (cube containing ℙ(K))' },
  ],
  value: showBox ? 'on' : 'off',
  onChange: (v) => { showBox = v === 'on'; rebuildBox(); },
});
boxNote = domainsFolder.text({ variant: 'meta' });

panel.separator();

// ─── View folder (depth, ball radius, fov) ───────────────────────────────────

const viewFolder = panel.folder('View', { open: false });

const slDepth = viewFolder.slider({
  label: 'depth N',
  min: 4, max: 13, step: 1, value: depth,
  onChange: (v) => { depth = v; regenerateOrbit(v); rebuildMesh(false); updateUI(); },
});

viewFolder.slider({
  label: 'ball radius',
  min: 0.001, max: 0.06, step: 0.0005, value: DEFAULT_RADIUS,
  format: (v) => v.toFixed(3), event: 'input',
  onChange: (v) => { uniforms.uRadius.value = v; },
});

const DEFAULT_FOV = app.camera.fov;
const slFov = viewFolder.slider({
  label: 'fov',
  min: 0.5, max: 90, step: 0.5, value: DEFAULT_FOV,
  format: (v) => `${v}°`, event: 'input',
  onChange: (v) => { app.camera.fov = v; app.camera.updateProjectionMatrix(); },
});

panel.separator();

panel.button({
  label: 'reset',
  onClick: () => {
    depth = DEFAULT_DEPTH;
    coordId = DEFAULT_COORD; denomIdx = DEFAULT_DENOM; axes = [...DEFAULT_AXES];
    domainMode = 'wire+body'; copyMode = 'base';
    domainSize = DOMAIN_DEFAULT_SIZE; showInterior = DEFAULT_SHOW_INTERIOR;
    showBox = false; splitAtInfinity = true; clipMultiple = CLIP_MULTIPLE_DEFAULT;
    edgeSet = 'hull'; showContainer = false;
    slDepth.set(DEFAULT_DEPTH);
    selCoord.set(DEFAULT_COORD); selPatch.set(String(DEFAULT_DENOM));
    populateAxes();
    selDomain.set(domainMode); selCopies.set(copyMode); selSplit.set('split'); slClip.set(CLIP_MULTIPLE_DEFAULT);
    selInterior.set(showInterior ? 'show' : 'hide'); slDomainSize.set(domainSize);
    selEdges.set('hull'); selContainer.set('off');
    selBox.set('off');
    rebuildCopyRays();
    slFov.set(DEFAULT_FOV); app.camera.fov = DEFAULT_FOV; app.camera.updateProjectionMatrix();
    applyChart();
    regenerateOrbit(depth);
    rebuildAll(true);
    updateUI();
  },
});

const modeEl  = panel.text({ variant: 'mode' });
const statsEl = panel.text({ variant: 'stats' });

panel.button({
  label: 'screenshot',
  onClick: () => app.screenshot(`c32_${proj.label}_${stats.kept}pts_${shotTimestamp()}.png`),
});

// ─── Export view for the offline figure renderer ─────────────────────────────
//
// The chart (denom + 3 rows) AND the domain layer are captured, so
// scripts/render/c32-render-limit-set.ts reproduces this exact framing — same
// copies, same style — at figure depth and resolution.

const exportStatus = panel.text({ variant: 'meta' });

panel.button({
  label: 'save view (offline render)',
  onClick: () => {
    const bundle: C32ViewPreset = {
      exampleId:    C32.id,
      previewDepth: depth,
      colorScheme:  schemeForColorDepth(0).name,
      projection: {
        denom: Array.from(proj.denom),
        rowX:  Array.from(proj.rows[0]),
        rowY:  Array.from(proj.rows[1]),
        rowZ:  Array.from(proj.rows[2]),
        label: proj.label,
      },
      camera:   cameraSpecFromApp(app),
      viewport: viewportFromApp(app),
      domain:   { copies: copyMode, mode: domainMode, showInterior, edges: edgeSet, container: showContainer },
    };
    void saveViewPreset('c32', bundle, (msg, ok) =>
      exportStatus.flash(msg, 3000, ok ? '#9ec79e' : '#d9a55c'));
  },
});

function shotTimestamp(): string {
  return new Date().toISOString().replace(/[-:]|\..*/g, '').replace('T', '-');
}

function updateUI(): void {
  statsEl.text(`${stats.totalWords.toLocaleString()} words, ${stats.kept.toLocaleString()} drawn`);
  modeEl.text(`view: ${proj.pretty}`);
  exMeta.html(
    `example: ${C32.label} (${C32.status})<br>` +
    `α = (${C32.alpha.join(', ')})<br>β = (${C32.beta.join(', ')})<br>γ = ${currentSeedName}`,
  );
}

// ─── Initial build (orbit + both layers; the HUD and domainNote now exist) ───

regenerateOrbit(depth);
rebuildCopyRays();
rebuildAll(true);
updateUI();
app.start();
