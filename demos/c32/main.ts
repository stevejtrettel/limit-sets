/**
 * C-32 — limit set viewer with the ping-pong convex domain ℙ(K).
 *
 * Two layers share one ℝ³ chart and camera:
 *   • the limit set Λ  — instanced spheres (proximal basepoint → BFS orbit).
 *   • the domain ℙ(K)  — the cone's projected 1-skeleton (wireframe) and/or its
 *                        translucent silhouette body.
 *
 * Coordinate pipeline (the "Coordinates" folder), applied to every point:
 *   1. compute in the companion basis (the repo's A₀,B₀);
 *   2. transform to a coordinate system  z = M·x  (companion M=I, u-basis M=P⁻¹);
 *   3. choose an affine patch (denominator zᵢ);
 *   4. choose the ℝ⁵→ℝ³ map (a coordinate triple).
 * Stages 2–4 collapse into one ChartEmbedding whose denom + rows are selected
 * rows of M (see `coordChart`). No PCA — explicit coordinate projections only.
 *
 * Thin wiring: `coords` (M, P⁻¹) + `copies` (S, T⁻¹ presets). The cone, its
 * facets/edges, and all drawing come from core/convex + app/convexMesh + the
 * `c32-cone` example. See README.md for the math and module map.
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
import { makeChartFromData, type ChartEmbedding } from '@/core/chart';
import { schemeForColorDepth } from '@/render/colorScheme.ts';
import { buildOrbitInstances } from '@/render/orbitInstances.ts';
import { COORD_SYSTEMS, coordSystemById, P } from './coords';
import { baseCopies, rotatedCopies, nestedCopies, type Copy } from './copies';
import { c32Cone } from '@/examples/hypergeometric/c32-cone';
import { transformCone, type ConvexCone } from '@/core/convex';
import { mat, matMul, type Mat } from '@/core/matrix';
import { coneDomainMesh, coneMembershipInstances, hexToRgb } from '@/app/convexMesh';

// ─── This demo is C-32, period ───────────────────────────────────────────────

const C32: SymplecticExample = exampleById('c32');
{
  const v = validateSymplecticExample(C32);
  if (!v.passed) throw new Error(`[c32] validation failed: ${v.errors.join('; ')}`);
  for (const w of v.warnings) console.warn(`[c32] ⚠ ${w}`);
}

const DEFAULT_DEPTH  = 12;
const DEFAULT_RADIUS = 0.025;

// Defaults: the notebook's known-good view (u-basis, patch e₀, axes (2,4,5)).
const DEFAULT_COORD = 'u';
const DEFAULT_DENOM = 0;
const DEFAULT_AXES: readonly [number, number, number] = [2, 4, 5];

// Domain ℙ(K) defaults + styling (per-copy colors live in copies.ts).
const DEFAULT_SHOW_INTERIOR = false;     // open on the silhouette shell (3D-hull boundary only)
const DOMAIN_DEFAULT_SIZE   = 0.006;     // edge-tube radius
const VERTEX_SCALE          = 1.8;       // vertexRadius / tubeRadius
const BODY_OPACITY          = 0.10;

// ─── Coordinate chart (stages 2+3+4) ─────────────────────────────────────────
//
// z = M·x are this system's coordinates; the chart divides by coord `denomIdx`
// and reads off `axes`. Since z_i = (row i of M)·x, the effective chart's denom
// and numerator rows are just the selected rows of M (companion: M = I → plain
// coordinate chart; u-basis: M = P⁻¹ → reads u-coordinates).

/** Build the ℝ⁶→ℝ³ chart for coordinate system `coordId`, patch `denomIdx`,
 *  view-axis triple `axes`. */
function coordChart(
  coordId: string,
  denomIdx: number,
  axes: readonly [number, number, number],
): ChartEmbedding {
  const sys = coordSystemById(coordId);
  const row = (i: number): number[] => sys.M[i].slice();
  return makeChartFromData({
    stateDim: 6,
    denom: row(denomIdx),
    rows: [row(axes[0]), row(axes[1]), row(axes[2])],
    denomIdx,
    label: `${coordId}-${axes.join('')}-d${denomIdx}`,
    pretty: `${sys.label}: (z${axes[0] + 1}, z${axes[1] + 1}, z${axes[2] + 1}) / z${denomIdx + 1}`,
  });
}

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
let proj: ChartEmbedding = coordChart(coordId, denomIdx, axes);

function applyChart(): void { proj = coordChart(coordId, denomIdx, axes); }

// Domain state. The base cone K (rays + its 33 facets + 680-edge 1-skeleton, all
// computed by core/convex) is built once; a copy g·K is `transformCone`d into
// COMPANION coords (rays P·g·rᵢ) so it projects through the same chart as the
// orbit. Edges + facets carry along (a linear iso preserves the face lattice).
const BASE_CONE = c32Cone();
const P_FLAT = mat(P as number[][]);
const drawableCone = (g: Mat): ConvexCone =>
  transformCone(BASE_CONE, matMul(P_FLAT, g));
// How to show the copies: as 3-D hulls (wire/body) OR as a coloring of Λ by cone
// membership. 'coloring' draws no hulls and recolors the limit set instead.
type DomainMode = 'none' | 'wire' | 'wire+body' | 'body' | 'coloring';
type CopyMode = 'base' | 'rotated' | 'nested';
let domainMode: DomainMode = 'wire+body';
let copyMode: CopyMode = 'base';
let domainSize = DOMAIN_DEFAULT_SIZE;
let showInterior = DEFAULT_SHOW_INTERIOR;   // false ⇒ only the 3D-hull boundary
let activeCopies: { copy: Copy; cone: ConvexCone }[] = [];
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

function copyListFor(m: CopyMode): Copy[] {
  return m === 'rotated' ? rotatedCopies() : m === 'nested' ? nestedCopies() : baseCopies();
}
/** Rebuild each active copy's drawable cone (companion coords + carried facets);
 *  only when the copy-mode changes — chart-independent. */
function rebuildCopyRays(): void {
  activeCopies = copyListFor(copyMode).map((copy) => ({ copy, cone: drawableCone(copy.g) }));
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

/** Is this cone inside the current affine patch? True iff the denominator
 *  covector is one-signed (and nonzero) over its rays — else the copy wraps
 *  through infinity in this chart and we cannot draw it. */
function bounded(cone: ConvexCone): boolean {
  const d = proj.denom;
  let lo = Infinity, hi = -Infinity;
  for (const r of cone.rays) {
    let s = 0;
    for (let j = 0; j < 6; j++) s += d[j] * r[j];
    if (s < lo) lo = s;
    if (s > hi) hi = s;
  }
  const eps = 1e-9;
  return lo > eps || hi < -eps;
}

function clearDomains(): void {
  for (const o of domainObjs) { app.scene.remove(o.group); o.dispose(); }
  domainObjs = [];
}

/** Draw one copy's cone (wireframe and/or silhouette body) in its colors. The
 *  generic convex-mesh builder projects through the active chart, computes the
 *  silhouette, and hides interior wireframe vertices unless `showInterior`. */
function drawCopy(copy: Copy, cone: ConvexCone): void {
  const d = coneDomainMesh(cone, proj, {
    edgeColor: copy.edge, tubeRadius: domainSize,
    vertexColor: copy.vertex, vertexRadius: domainSize * VERTEX_SCALE,
    bodyColor: copy.body, bodyOpacity: BODY_OPACITY,
  }, { showVertices: showWire(), showEdges: showWire(), showBody: showBody(), showInterior });
  app.scene.add(d.group);
  domainObjs.push(d);
}

function rebuildDomains(): void {
  clearDomains();
  if (domainMode === 'none') { domainNote?.text(''); return; }
  if (coloring()) {
    const n = activeCopies.length;
    domainNote?.text(`coloring Λ by membership in ${n} cone${n > 1 ? 's' : ''}`);
    return;   // the coloring lives in the mesh (rebuildMesh), no hulls drawn
  }

  let drawn = 0;
  for (const { copy, cone } of activeCopies) {
    if (!bounded(cone)) continue;
    drawCopy(copy, cone);
    drawn++;
  }

  const total = activeCopies.length;
  if (drawn === 0) {
    domainNote?.text('⚠ nothing drawable in this patch (crosses infinity)');
  } else if (total === 1) {
    domainNote?.text(`ℙ(K): ${BASE_CONE.rays.length} vertices, ${BASE_CONE.edges.length} edges` +
      (showInterior ? '' : ' (silhouette shell)'));
  } else {
    domainNote?.text(`${drawn}/${total} copies drawn` +
      (drawn < total ? ` (${total - drawn} unbounded in this patch)` : ''));
  }
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

/** Rebuild both layers after a chart change (re-frame on Λ). */
function rebuildAll(autofit: boolean): void {
  rebuildMesh(autofit);
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
  onChange: (v) => { copyMode = v as CopyMode; rebuildCopyRays(); rebuildMesh(false); rebuildDomains(); updateUI(); },
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
    showBox = false;
    slDepth.set(DEFAULT_DEPTH);
    selCoord.set(DEFAULT_COORD); selPatch.set(String(DEFAULT_DENOM));
    populateAxes();
    selDomain.set(domainMode); selCopies.set(copyMode);
    selInterior.set(showInterior ? 'show' : 'hide'); slDomainSize.set(domainSize);
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
