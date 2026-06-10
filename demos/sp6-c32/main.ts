/**
 * Sp(6,Z) C-32 — limit set + ping-pong convex domains.
 *
 * The picture is always the same two layers:
 *   1. the limit set Λ  (drawn every frame), and
 *   2. copies of the convex ping-pong domain K, overlaid on top as convex hulls.
 *
 * A chart = basis (which coordinates) × affine patch (denominator hyperplane) ×
 * view axes (the R⁶→R³ numerator). The convex-domain overlay chooses *which*
 * copies of K to draw:
 *   none     — just the limit set.
 *   K        — the ping-pong domain itself.
 *   SᵏK      — its six order-6 rotations (only the ones bounded in this chart).
 *   T⁻¹SᵏK   — the six ping-pong branch images, which all nest inside K.
 *
 * A hull is only drawn when it is *bounded* in the current chart, i.e. the
 * denominator is one-signed on its rays (hullValidForMatrix). No single chart
 * bounds all six rotations of the fat domain at once; the branch images do all
 * fit because T⁻¹ pulls them back inside K (GᵢK ⊆ K).
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { ControlPanel } from '@/app/ControlPanel';
import { createSphereMaterial, makeInstancedSpheres } from '@/app/instancedSpheres';
import { autofitCamera } from '@/app/autofit';
import {
  raysUnit, raysCompanion, NUM_RAYS, conjugateOrbitToU, inCone, dominantDenom,
  order6Matrix, transvectionInv,
} from './cone';
import { buildHullGroup, disposeHullGroup } from './hull';

import { exampleById, type ExampleGroup } from '@/sp6/examples';
import { makeSp6Action } from '@/sp6/action';
import { validateExample } from '@/sp6/validate';
import type { GroupAction } from '@/core/group';
import { computeProximalBasepoint, generateOrbit, type Orbit } from '@/core/orbit';
import {
  type ChartEmbedding, EPS_CHART, fitPCAChartEmbeddingWithDenom, makeChartFromData,
} from '@/core/chart';
import type { SceneEmbedding } from '@/core/scene';
import { schemeForColorDepth } from '@/render/colorScheme.ts';
import { buildOrbitInstances } from '@/render/orbitInstances.ts';
import { paletteForScheme } from '@/sp6/palettes.ts';

// ─── This demo is C-32, period ───────────────────────────────────────────────

const C32: ExampleGroup = exampleById('c32');
{
  const v = validateExample(C32);
  if (!v.passed) throw new Error(`[sp6-c32] validation failed: ${v.errors.join('; ')}`);
  for (const w of v.warnings) console.warn(`[sp6-c32] ⚠ ${w}`);
}

const DEFAULT_DEPTH = 12;
const DEFAULT_RADIUS = 0.025;
const DEFAULT_PATCH: Patch = 'cone';
const DEFAULT_CHART = 'pca';
const DEFAULT_DOMAIN: DomainMode = 'cone';

// ─── Linear-algebra helpers (6×6) ─────────────────────────────────────────────

const IDENTITY6: number[][] = Array.from({ length: 6 }, (_, i) =>
  Array.from({ length: 6 }, (_, j) => (i === j ? 1 : 0)));

function matmul6(A: readonly (readonly number[])[], B: readonly (readonly number[])[]): number[][] {
  const C = Array.from({ length: 6 }, () => new Array<number>(6).fill(0));
  for (let i = 0; i < 6; i++)
    for (let j = 0; j < 6; j++) {
      let s = 0;
      for (let t = 0; t < 6; t++) s += A[i][t] * B[t][j];
      C[i][j] = s;
    }
  return C;
}

/** k-th power of the active-basis order-6 matrix (S in the u-basis, B₀ in the
 *  companion basis). S⁶ = -I, so the six powers k=0..5 are projectively distinct. */
function order6Pow(k: number): number[][] {
  const M = order6Matrix(basisU);
  let R = IDENTITY6.map((r) => r.slice());
  for (let p = 0; p < k; p++) R = matmul6(M, R);
  return R;
}

// ─── Chart (basis × affine patch × view axes) ─────────────────────────────────

type Patch = 'cone' | 'coord0';

/** Denominator covector for the active basis + affine patch.
 *  'cone'   — the cone's dominant hyperplane (interior to K*); the hull of K is
 *             honest here. e₀ in the u-basis, e₀∘P⁻¹ in the companion basis.
 *  'coord0' — x₀ = 1 in the active basis (the sp6-limit-sets patch). */
function currentDenom(): number[] {
  if (patch === 'cone') return dominantDenom(basisU);
  const e0 = new Array<number>(6).fill(0); e0[0] = 1;
  return e0;
}

interface ProjSpec { value: string; label: string; build: (o: Orbit) => ChartEmbedding; }

/** Chart with the current patch denominator and an explicit numerator triple. */
function axisChart(idxs: readonly [number, number, number]): ChartEmbedding {
  const rows = idxs.map((j) => {
    const r = new Array<number>(6).fill(0); r[j] = 1; return r as readonly number[];
  }) as [readonly number[], readonly number[], readonly number[]];
  return makeChartFromData({
    stateDim: 6, denom: currentDenom(), rows,
    label: `${patch}-${idxs.join('')}`,
    pretty: `(${idxs.map((j) => `v${j + 1}`).join(', ')}) / ${patch} patch`,
  });
}
/** Chart with the current patch denominator and PCA-chosen numerator axes. */
function pcaChart(o: Orbit): ChartEmbedding {
  return fitPCAChartEmbeddingWithDenom(o, currentDenom(), `${patch}-pca`, `PCA in ${patch} patch`)
    ?? axisChart([3, 4, 5]);
}

const PROJECTIONS: readonly ProjSpec[] = [
  { value: 'pca',  label: 'PCA axes',       build: (o) => pcaChart(o) },
  { value: 'a345', label: 'coords (3,4,5)', build: () => axisChart([3, 4, 5]) },
  { value: 'a123', label: 'coords (1,2,3)', build: () => axisChart([1, 2, 3]) },
  { value: 'a135', label: 'coords (1,3,5)', build: () => axisChart([1, 3, 5]) },
];

// ─── Scene + state ────────────────────────────────────────────────────────────

const app = new App({ antialias: true });
app.scene.background = new THREE.Color(0xf2f2f2);

const { material, uniforms } = createSphereMaterial(DEFAULT_RADIUS);
const action: GroupAction = makeSp6Action(C32);

let basepoint!: Float64Array;
let orbit!:     Orbit;
let proj!:      ChartEmbedding;
let limitMesh: THREE.Mesh | null = null;   // layer 1: the limit set Λ (always)
let domainGroup: THREE.Group | null = null; // layer 2: convex-domain copies

let depth = DEFAULT_DEPTH;
let colorDepth = 0;
let clipToConeOnly = false;          // draw only the in-cone part X⁺ of Λ
let basisU = true;                   // u-basis (paper S,T) vs companion (A₀,B₀)
let patch: Patch = DEFAULT_PATCH;
let domain: DomainMode = DEFAULT_DOMAIN;
let domainTube = 0.012;
let stats = { kept: 0, totalWords: 0 };

const uRays = raysUnit();
const companionRays = raysCompanion();
function currentRays(): Float64Array { return basisU ? uRays : companionRays; }

{
  const r = computeProximalBasepoint(action, C32.gamma, C32.powerIter);
  basepoint = r.basepoint;
  console.log(
    `[sp6-c32] loaded: |λ_max(${C32.gammaName})| ≈ ${r.lambdaMax.toFixed(3)}, ` +
    `drift = ${r.drift.toFixed(4)}`,
  );
}

function regenerateOrbit(N: number): void {
  const t0 = performance.now();
  orbit = generateOrbit(action, basepoint, N);
  // In u-basis mode, conjugate the orbit (generated in the companion basis) into
  // the paper's u-basis, where the rays live. In companion mode we leave it and
  // bring the rays over instead (see currentRays / raysCompanion).
  if (basisU) conjugateOrbitToU(orbit.vecs, orbit.count);
  console.log(`[sp6-c32] BFS depth=${N} words=${orbit.count} (${(performance.now() - t0).toFixed(0)}ms)`);
}

function applyChartSelection(value: string): void {
  proj = (PROJECTIONS.find((p) => p.value === value) ?? PROJECTIONS[0]).build(orbit);
}

// ─── Layer 1: the limit set Λ (always drawn) ──────────────────────────────────

/** Restrict Λ to the part inside the cone ℙ(K) (H·y ≥ 0), the piece that the
 *  domain hull actually contains. Δ₀ ⊋ ℙ(K), so this is a true cone clip. */
function clipToConeEmbedding(emb: ChartEmbedding): SceneEmbedding {
  return {
    stateDim: emb.stateDim,
    label: `${emb.label}|K`,
    pretty: `${emb.pretty}, clipped to ℙ(K)`,
    embed(buf, off, out, outOff) {
      if (!inCone(buf, off, basisU)) return false;
      return emb.embed(buf, off, out, outOff);
    },
  };
}

function rebuildLimitSet(autofit: boolean): void {
  if (limitMesh) { app.scene.remove(limitMesh); limitMesh.geometry.dispose(); limitMesh = null; }
  const scheme = schemeForColorDepth(colorDepth);
  const palette = paletteForScheme(scheme.name);
  const emb = clipToConeOnly ? clipToConeEmbedding(proj) : proj;
  const { aPos, aColor, kept } = buildOrbitInstances(emb, orbit, scheme, palette);
  limitMesh = makeInstancedSpheres(material, aPos, aColor);
  app.scene.add(limitMesh);
  if (autofit) autofitCamera(app, aPos, kept);
  stats = { kept, totalWords: orbit.count };
}

// ─── Layer 2: convex-domain copies (overlay) ──────────────────────────────────

type DomainMode = 'none' | 'cone' | 'rotated' | 'branch';

/** Six well-separated colors for the order-6 copies. */
const DOMAIN_COLORS: readonly (readonly [number, number, number])[] = [
  [0.85, 0.20, 0.20], [0.90, 0.55, 0.10], [0.20, 0.65, 0.25],
  [0.15, 0.55, 0.80], [0.45, 0.25, 0.75], [0.80, 0.25, 0.60],
];
const CONE_HEX = 0x2f8f8f;

function rgbToHex(c: readonly [number, number, number]): number {
  const q = (x: number) => Math.max(0, Math.min(255, Math.round(x * 255)));
  return (q(c[0]) << 16) | (q(c[1]) << 8) | q(c[2]);
}

/** The list of domain copies to draw for the current mode: matrix Mₖ (so the
 *  copy is MₖK), color, and face opacity. */
function domainCopies(): { Mk: number[][]; hex: number; faceOpacity: number }[] {
  if (domain === 'none') return [];
  if (domain === 'cone') return [{ Mk: IDENTITY6, hex: CONE_HEX, faceOpacity: 0.08 }];
  const out: { Mk: number[][]; hex: number; faceOpacity: number }[] = [];
  if (domain === 'branch') {                       // T⁻¹SᵏK nested inside K
    out.push({ Mk: IDENTITY6, hex: CONE_HEX, faceOpacity: 0.04 });  // parent K, faint
    const Tinv = transvectionInv(basisU);
    for (let k = 0; k < 6; k++)
      out.push({ Mk: matmul6(Tinv, order6Pow(k)), hex: rgbToHex(DOMAIN_COLORS[k]), faceOpacity: 0.10 });
  } else {                                          // rotated SᵏK
    for (let k = 0; k < 6; k++)
      out.push({ Mk: order6Pow(k), hex: rgbToHex(DOMAIN_COLORS[k]), faceOpacity: 0.10 });
  }
  return out;
}

const mRay = new Float64Array(6);
const rayScratch = new Float64Array(3);

/** A copy MₖK is drawable only if its rays are one-signed under the chart
 *  denominator — otherwise ℙ(MₖK) is unbounded in this chart and its hull would
 *  be meaningless, so we skip it. */
function copyBounded(Mk: number[][]): boolean {
  const rays = currentRays();
  const d = proj.denom;
  let sign = 0;
  for (let r = 0; r < NUM_RAYS; r++) {
    let dv = 0;
    for (let i = 0; i < 6; i++) {
      let s = 0; const Mi = Mk[i];
      for (let j = 0; j < 6; j++) s += Mi[j] * rays[r * 6 + j];
      dv += d[i] * s;
    }
    if (Math.abs(dv) < EPS_CHART) return false;
    const s = dv > 0 ? 1 : -1;
    if (sign === 0) sign = s; else if (s !== sign) return false;
  }
  return true;
}

/** Project the rays of the copy MₖK into the current chart. */
function projectCopyRays(Mk: number[][]): THREE.Vector3[] {
  const rays = currentRays();
  const pts: THREE.Vector3[] = [];
  for (let r = 0; r < NUM_RAYS; r++) {
    for (let i = 0; i < 6; i++) {
      let s = 0; const Mi = Mk[i];
      for (let j = 0; j < 6; j++) s += Mi[j] * rays[r * 6 + j];
      mRay[i] = s;
    }
    if (proj.embed(mRay, 0, rayScratch, 0)) {
      pts.push(new THREE.Vector3(rayScratch[0], rayScratch[1], rayScratch[2]));
    }
  }
  return pts;
}

function rebuildDomains(): void {
  if (domainGroup) { app.scene.remove(domainGroup); disposeHullGroup(domainGroup); domainGroup = null; }
  const copies = domainCopies();
  if (copies.length === 0) return;

  const container = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  let drawn = 0;
  for (const { Mk, hex, faceOpacity } of copies) {
    if (!copyBounded(Mk)) continue;     // unbounded in this chart → skip
    const { group } = buildHullGroup(projectCopyRays(Mk), {
      tubeRadius: domainTube, vertexRadius: domainTube * 2.2,
      faceColor: hex, faceOpacity, edgeColor: hex, vertexColor: hex,
    });
    container.add(group);
    disposables.push(...((group.userData.disposables as { dispose(): void }[]) ?? []));
    drawn++;
  }
  container.userData.disposables = disposables;
  app.scene.add(container);
  domainGroup = container;
  console.log(`[sp6-c32] domain '${domain}': ${drawn}/${copies.length} hull(s) drawn`);
}

/** Redraw both layers (after anything that moves the projection). */
function rebuildAll(autofit: boolean): void {
  rebuildLimitSet(autofit);
  rebuildDomains();
}

// ─── Initial build ────────────────────────────────────────────────────────────

regenerateOrbit(depth);
applyChartSelection(DEFAULT_CHART);
rebuildAll(true);

// ─── HUD ──────────────────────────────────────────────────────────────────────

const panel = new ControlPanel({ title: 'Sp(6,Z) — C-32' });
const exMeta = panel.text({ variant: 'meta' });

panel.separator();

const slDepth = panel.slider({
  label: 'depth N',
  min: 4, max: 13, step: 1, value: depth,
  onChange: (v) => { depth = v; regenerateOrbit(v); rebuildLimitSet(false); updateUI(); },
});

panel.slider({
  label: 'ball radius',
  min: 0.001, max: 0.06, step: 0.0005, value: DEFAULT_RADIUS,
  format: (v) => v.toFixed(3), event: 'input',
  onChange: (v) => { uniforms.uRadius.value = v; },
});

const DEFAULT_FOV = app.camera.fov;
const slFov = panel.slider({
  label: 'fov',
  min: 0.5, max: 90, step: 0.5, value: DEFAULT_FOV,
  format: (v) => `${v}°`, event: 'input',
  onChange: (v) => { app.camera.fov = v; app.camera.updateProjectionMatrix(); },
});

panel.separator();

const selBasis = panel.select({
  label: 'basis',
  options: [
    { value: 'u',    label: 'u-basis (paper: S, T)' },
    { value: 'orig', label: 'original (companion A₀, B₀)' },
  ],
  value: 'u',
  onChange: (v) => {
    basisU = v === 'u';
    regenerateOrbit(depth);
    applyChartSelection(selChart.value);
    rebuildAll(true);
    updateUI();
  },
});

const selPatch = panel.select({
  label: 'affine patch',
  options: [
    { value: 'cone',   label: 'cone-dominant ℙ(K)' },
    { value: 'coord0', label: 'x₀ = 1 (sp6-limit-sets)' },
  ],
  value: DEFAULT_PATCH,
  onChange: (v) => {
    patch = v as Patch;
    applyChartSelection(selChart.value);
    rebuildAll(true);
    updateUI();
  },
});

const selChart = panel.select({
  label: 'view axes',
  options: PROJECTIONS.map((p) => ({ value: p.value, label: p.label })),
  value: DEFAULT_CHART,
  onChange: (v) => { applyChartSelection(v); rebuildAll(true); updateUI(); },
});

panel.separator();

const selClip = panel.select({
  label: 'limit set Λ',
  options: [
    { value: 'full', label: 'full (all chambers)' },
    { value: 'cone', label: 'clip to ℙ(K)' },
  ],
  value: 'full',
  onChange: (v) => { clipToConeOnly = v === 'cone'; rebuildLimitSet(true); updateUI(); },
});

panel.select({
  label: 'color by',
  options: [
    { value: '0', label: 'grayscale' },
    { value: '1', label: 'last letter (g_n)' },
    { value: '2', label: '2nd-to-last letter (g_{n−1})' },
    { value: '3', label: '3rd-to-last letter (g_{n−2})' },
    { value: '4', label: '4th-to-last letter (g_{n−3})' },
    { value: '5', label: '5th-to-last letter (g_{n−4})' },
  ],
  value: '0',
  onChange: (v) => { colorDepth = parseInt(v, 10); rebuildLimitSet(false); updateUI(); },
});

panel.separator();

// The whole point: which copies of the convex ping-pong domain to overlay.
const selDomain = panel.select({
  label: 'convex domain',
  options: [
    { value: 'none',    label: 'none' },
    { value: 'cone',    label: 'K (ping-pong domain)' },
    { value: 'rotated', label: 'rotated copies SᵏK' },
    { value: 'branch',  label: 'branch copies T⁻¹SᵏK (nested in K)' },
  ],
  value: DEFAULT_DOMAIN,
  onChange: (v) => { domain = v as DomainMode; rebuildDomains(); },
});

panel.slider({
  label: 'domain edge size',
  min: 0.002, max: 0.05, step: 0.001, value: domainTube,
  format: (v) => v.toFixed(3),
  onChange: (v) => { domainTube = v; rebuildDomains(); },
});

panel.button({
  label: 'reset',
  onClick: () => {
    depth = DEFAULT_DEPTH; colorDepth = 0; clipToConeOnly = false;
    basisU = true; patch = DEFAULT_PATCH; domain = DEFAULT_DOMAIN;
    slDepth.set(DEFAULT_DEPTH);
    selBasis.set('u'); selPatch.set(DEFAULT_PATCH); selChart.set(DEFAULT_CHART);
    selClip.set('full'); selDomain.set(DEFAULT_DOMAIN);
    slFov.set(DEFAULT_FOV); app.camera.fov = DEFAULT_FOV; app.camera.updateProjectionMatrix();
    regenerateOrbit(depth);
    applyChartSelection(DEFAULT_CHART);
    rebuildAll(true);
    updateUI();
  },
});

const modeEl  = panel.text({ variant: 'mode' });
const statsEl = panel.text({ variant: 'stats' });

panel.button({
  label: 'screenshot',
  onClick: () => app.screenshot(`sp6-c32_${proj.label}_${stats.kept}pts_${shotTimestamp()}.png`),
});

panel.separator();

panel.button({ label: 'export view → offline render', onClick: exportView });
const exportStatus = panel.text({ variant: 'meta' });

function shotTimestamp(): string {
  return new Date().toISOString().replace(/[-:]|\..*/g, '').replace('T', '-');
}

/** Serialize the current view (camera + exact R⁶→R³ projection + basis/clip/
 *  domain) so the offline renderer reproduces this framing at high depth. */
async function exportView(): Promise<void> {
  const cam = app.camera as THREE.PerspectiveCamera;
  const tgt = app.controls.target;
  const canvas = app.renderManager.renderer.domElement;
  const bundle = {
    basis: basisU ? 'u' : 'companion', patch, clip: clipToConeOnly, domain, depth,
    projection: {
      denom: Array.from(proj.denom),
      rowX: Array.from(proj.rows[0]), rowY: Array.from(proj.rows[1]), rowZ: Array.from(proj.rows[2]),
      label: proj.label,
    },
    camera: {
      position: [cam.position.x, cam.position.y, cam.position.z],
      target:   [tgt.x, tgt.y, tgt.z],
      up:       [cam.up.x, cam.up.y, cam.up.z],
      fov: cam.fov, aspect: cam.aspect, near: cam.near, far: cam.far,
    },
    viewport: { width: canvas.clientWidth, height: canvas.clientHeight },
  };
  const json = JSON.stringify(bundle, null, 2);
  console.log('[sp6-c32] view JSON:\n' + json);
  let saved = false;
  try {
    const r = await fetch('/__save-view/sp6c32', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: json,
    });
    if (r.ok) { saved = true; exportStatus.flash('saved scripts/sp6-c32-view-preset.json', 3000, '#9ec79e'); }
  } catch { /* fall through to clipboard */ }
  if (!saved) {
    try { await navigator.clipboard.writeText(json); exportStatus.flash('copied to clipboard', 3000, '#d9a55c'); }
    catch { exportStatus.flash('see console for JSON', 3000, '#d9a55c'); }
  }
}

function updateUI(): void {
  statsEl.text(`${stats.totalWords.toLocaleString()} words, ${stats.kept.toLocaleString()} drawn`);
  modeEl.text(`view: ${proj.pretty}`);
  exMeta.html(
    `example: ${C32.label} (${C32.nature})<br>` +
    `α = ${C32.alpha}<br>β = ${C32.beta}<br>γ = ${C32.gammaName}`,
  );
}

updateUI();
app.start();
