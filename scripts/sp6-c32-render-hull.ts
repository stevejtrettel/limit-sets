/**
 * sp6-c32-render-hull.ts
 *
 * Offline render of the C-32 limit set *with the ping-pong cone ℙ(K) drawn as
 * a translucent glass box* — the streaming-orbit density image of the existing
 * renderer, plus a convex-hull overlay (light-blue transparent faces + edge
 * lines) of the cone's 254 extremal rays.
 *
 * Everything is drawn in the paper's u-basis, in a chart whose denominator is
 * the cone's dominant hyperplane (e₀). This is the ONLY chart family in which
 * the convex hull of the projected rays honestly equals the projected cone:
 * e₀ is interior to the dual cone K*, so every ray has y₀ > 0 and ℙ(K) maps to
 * a bounded convex region. (See demos/sp6-c32/cone.ts + the memory notes.)
 *
 * Pipeline:
 *   1. u-basis matrix action  — companion generators conjugated by P.
 *   2. proximal basepoint + chart (dominant-denom PCA) fit on a pilot orbit.
 *   3. limit set  — stream DFS → accumulator → tone → grayscale RGBA, with an
 *                   optional clip to ℙ(K) (facets H) so Λ sits inside the box.
 *   4. hull box   — embed the 254 rays → R³ → 3D ConvexHull → project → fill
 *                   translucent faces (polyFill) + stroke edges (lineRaster).
 *   5. write PNG to the repo root.
 *
 *   node scripts/sp6-c32-render-hull.ts [depth] [--full] [--max-dim N]
 *                                       [--edge-width PX] [--vertex-radius PX]
 */

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { ConvexHull } from 'three/examples/jsm/math/ConvexHull.js';
import { Vector3 } from 'three';

import { exampleById } from '../src/sp6/examples.ts';
import { makeSp6Action } from '../src/sp6/action.ts';
import type { GroupAction } from '../src/core/group.ts';
import {
  computeProximalBasepoint, generateOrbit, streamOrbit,
} from '../src/core/orbit.ts';
import {
  fitPCAChartEmbeddingWithDenom, makeChartFromData, type ChartEmbedding,
} from '../src/core/chart.ts';
import {
  makeOrthographicCamera, makePerspectiveCamera, resolveImageDims, type Camera,
} from '../src/core/camera.ts';
import { composeProjector } from '../src/core/scene.ts';
import { createAccumulator } from '../src/render/accumulator.ts';
import { accumulatorToRGBA, type Bg } from '../src/render/tone.ts';
import { writePng } from '../src/render/png.ts';
import { drawLineAA, type RGB } from '../src/render/lineRaster.ts';
import { fillTriangleAlpha } from '../src/render/polyFill.ts';
import { createProgress, formatCount } from '../src/render/progress.ts';
import { makeIntegerDeposit } from '../src/render/splat.ts';

// ─── EDITABLE ───────────────────────────────────────────────────────────────

const DEFAULT_DEPTH = 13;
const PILOT_DEPTH   = 11;     // pilot BFS for the PCA chart fit + bbox
let   MAX_DIM       = 4096;
const MIN_DIM       = 128;
const DIM_ROUND     = 16;

// Clip Λ to the cone ℙ(K) so it sits inside the box. Off (--full) draws the
// whole orbit, which in this chart runs off to infinity (Λ fills all six
// chambers; the e₀ chart only frames the Δ₀ piece).
let   CLIP_TO_CONE  = true;

// Tone-map (limit set layer).
const TONE_PERCENTILE = 0.999;
const BG: Bg          = 'white';
const TONE_GAMMA      = 1;

// Hull box styling — a glass box with a bold wireframe + chunky corners.
const FACE_COLOR: RGB   = [120, 170, 235];  // light blue
const FACE_ALPHA        = 0.08;
const EDGE_COLOR: RGB   = [150, 180, 220];   // pale blue
const EDGE_OPACITY      = 0.7;              // bolder wireframe
let   EDGE_WIDTH_PX     = 4;                // stroke thickness (--edge-width)
const VERTEX_COLOR: RGB = [225, 150, 80];   // soft orange corners
let   VERTEX_RADIUS_PX  = 6;                // corner-dot radius (--vertex-radius)
const EDGE_COPLANAR_DOT = 0.9998;           // cos≈1.1°: below ⇒ a real edge
const MARGIN            = 0.06;             // frame padding around the box

// ─── Args ───────────────────────────────────────────────────────────────────

const log = (m: string): void => { process.stderr.write(m + '\n'); };
const ARGS = process.argv.slice(2);
if (ARGS.includes('--full')) CLIP_TO_CONE = false;
{
  const i = ARGS.indexOf('--max-dim');
  if (i >= 0 && ARGS[i + 1]) { const n = parseInt(ARGS[i + 1], 10); if (n >= 256) MAX_DIM = n; }
}
// Dolly factor for the preset perspective camera: scales the eye distance from
// the target (>1 pulls back / zooms out, <1 moves in). Fixes a framing that
// came out tighter than the browser. No effect in autofit mode.
let ZOOM = 1;
{
  const i = ARGS.indexOf('--zoom');
  if (i >= 0 && ARGS[i + 1]) { const n = parseFloat(ARGS[i + 1]); if (Number.isFinite(n) && n > 0) ZOOM = n; }
}
{
  const i = ARGS.indexOf('--edge-width');
  if (i >= 0 && ARGS[i + 1]) { const n = parseFloat(ARGS[i + 1]); if (Number.isFinite(n) && n >= 1) EDGE_WIDTH_PX = n; }
}
{
  const i = ARGS.indexOf('--vertex-radius');
  if (i >= 0 && ARGS[i + 1]) { const n = parseFloat(ARGS[i + 1]); if (Number.isFinite(n) && n >= 0) VERTEX_RADIUS_PX = n; }
}
const VALUE_FLAGS = new Set(['--max-dim', '--zoom', '--edge-width', '--vertex-radius']);
let DEPTH = DEFAULT_DEPTH;
{
  const a = ARGS.find((s, k) => !s.startsWith('--') && !VALUE_FLAGS.has(ARGS[k - 1]));
  if (a !== undefined) { const n = parseInt(a, 10); if (n >= 1) DEPTH = n; }
}

// ─── Cone data (rays + facets H, u-basis) and the change of basis P ─────────

const CONE = JSON.parse(readFileSync(
  fileURLToPath(new URL('../demos/sp6-c32/c32-extremal-rays.json', import.meta.url)), 'utf8',
)) as { num_rays: number; rays: number[][]; facets: number[][] };
const RAYS: number[][]   = CONE.rays;
const FACETS: number[][] = CONE.facets;

// P = companion ← u change of basis (columns (−1)ⁱ B₀ⁱ v); mirrors cone.ts.
const P: number[][] = [
  [  0,   5,  11,  14,  11,   5],
  [  5,   0,  -5, -11, -14, -11],
  [-11,  -5,   0,   5,  11,  14],
  [ 14,  11,   5,   0,  -5, -11],
  [-11, -14, -11,  -5,   0,   5],
  [  5,  11,  14,  11,   5,   0],
];

function invert6(M: number[][]): number[][] {
  const a = M.map((r) => r.slice());
  const inv: number[][] = Array.from({ length: 6 }, (_, i) =>
    Array.from({ length: 6 }, (_, j) => (i === j ? 1 : 0)));
  for (let c = 0; c < 6; c++) {
    let p = c;
    for (let r = c + 1; r < 6; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r;
    [a[c], a[p]] = [a[p], a[c]]; [inv[c], inv[p]] = [inv[p], inv[c]];
    const pv = a[c][c];
    for (let j = 0; j < 6; j++) { a[c][j] /= pv; inv[c][j] /= pv; }
    for (let r = 0; r < 6; r++) {
      if (r === c) continue;
      const f = a[r][c]; if (f === 0) continue;
      for (let j = 0; j < 6; j++) { a[r][j] -= f * a[c][j]; inv[r][j] -= f * inv[c][j]; }
    }
  }
  return inv;
}
function matmul(A: number[][], B: number[][]): number[][] {
  return Array.from({ length: 6 }, (_, i) =>
    Array.from({ length: 6 }, (_, j) => {
      let s = 0; for (let k = 0; k < 6; k++) s += A[i][k] * B[k][j]; return s;
    }));
}
const P_INV = invert6(P);

// ─── u-basis matrix action: P⁻¹ · (companion gen) · P ───────────────────────

const C32 = exampleById('c32');
const COMP = makeSp6Action(C32);
function companionGenMatrix(g: number): number[][] {
  const M = Array.from({ length: 6 }, () => new Array<number>(6).fill(0));
  const src = new Float64Array(6), dst = new Float64Array(6);
  for (let c = 0; c < 6; c++) {
    src.fill(0); src[c] = 1;
    COMP.apply(g, src, 0, dst, 0);
    for (let r = 0; r < 6; r++) M[r][c] = dst[r];
  }
  return M;
}
const U_MATS: number[][][] = [0, 1, 2, 3].map((g) =>
  matmul(P_INV, matmul(companionGenMatrix(g), P)));

const _applyTmp = new Float64Array(6);
const U_ACTION: GroupAction = {
  numGenerators: 4,
  stateDim: 6,
  inverse: new Uint8Array([1, 0, 3, 2]),
  apply(g, src, so, dst, dof) {
    // Compute into a scratch buffer first: callers (computeProximalBasepoint)
    // invoke this in place (src === dst, so === dof), and a naive row-by-row
    // write would clobber later inputs.
    const M = U_MATS[g];
    for (let i = 0; i < 6; i++) {
      let s = 0; const Mi = M[i];
      for (let j = 0; j < 6; j++) s += Mi[j] * src[so + j];
      _applyTmp[i] = s;
    }
    for (let i = 0; i < 6; i++) dst[dof + i] = _applyTmp[i];
  },
  normalize(buf, off) {
    let s = 0; for (let i = 0; i < 6; i++) s += buf[off + i] * buf[off + i];
    if (s === 0) return;
    const inv = 1 / Math.sqrt(s); for (let i = 0; i < 6; i++) buf[off + i] *= inv;
  },
};

// Cone membership in u-coords: H·y ≥ 0 up to representative sign (y₀ > 0).
function inConeU(buf: Float64Array, off: number): boolean {
  const sign = buf[off] >= 0 ? 1 : -1;
  for (let r = 0; r < FACETS.length; r++) {
    const h = FACETS[r];
    let dot = 0; for (let j = 0; j < 6; j++) dot += h[j] * buf[off + j];
    if (sign * dot < -1e-9) return false;
  }
  return true;
}

// ─── Optional saved view preset (camera + exact projection) ─────────────────

interface ViewPreset {
  basis: 'u' | 'companion';
  clip: boolean;
  rosette?: boolean;
  depth?: number;
  projection: { denom: number[]; rowX: number[]; rowY: number[]; rowZ: number[]; label?: string };
  camera: {
    position: [number, number, number]; target: [number, number, number];
    up: [number, number, number]; fov: number; aspect: number; near: number; far: number;
  };
  viewport: { width: number; height: number };
}
// NB: the dev-server middleware writes scripts/<group>-view-preset.json with
// group = 'sp6c32' (no hyphen), so the file is sp6c32-view-preset.json.
const PRESET_PATH = fileURLToPath(new URL('./sp6c32-view-preset.json', import.meta.url));
let PRESET: ViewPreset | null = null;
if (existsSync(PRESET_PATH)) {
  try {
    PRESET = JSON.parse(readFileSync(PRESET_PATH, 'utf8')) as ViewPreset;
    if (!ARGS.includes('--full')) CLIP_TO_CONE = PRESET.clip;
    log(`[sp6-c32-hull] loaded view preset (basis=${PRESET.basis}, clip=${PRESET.clip}` +
        (PRESET.rosette ? ', rosette=on [script draws single hull]' : '') + ')');
  } catch (e) {
    log(`[sp6-c32-hull] ignoring malformed preset: ${(e as Error).message}`); PRESET = null;
  }
}

// ─── Basepoint, chart, camera ───────────────────────────────────────────────

log(`[sp6-c32-hull] example=C-32  depth=${DEPTH}  clip=${CLIP_TO_CONE ? 'cone ℙ(K)' : 'none'}` +
    (PRESET ? '  view=preset' : '  view=autofit'));
const bp = computeProximalBasepoint(U_ACTION, C32.gamma, C32.powerIter);
log(`[sp6-c32-hull] |λ_max(γ)| ≈ ${bp.lambdaMax.toFixed(3)}  drift=${bp.drift.toFixed(4)}`);

// Chart: the exact preset map (transported to u-coords if the preset was
// exported in the companion basis), or a fresh dominant-denom PCA fit.
let chart: ChartEmbedding;
let pilot: ReturnType<typeof generateOrbit> | null = null;
if (PRESET) {
  const pj = PRESET.projection;
  let denom = pj.denom.slice();
  let rows: number[][] = [pj.rowX.slice(), pj.rowY.slice(), pj.rowZ.slice()];
  if (PRESET.basis === 'companion') {
    // The script streams the orbit in the u-basis; a companion-basis chart C(x)
    // with x = P·y reads the same point as the transported chart (C·P)(y).
    const vP = (v: number[]): number[] =>
      Array.from({ length: 6 }, (_, j) => { let s = 0; for (let i = 0; i < 6; i++) s += v[i] * P[i][j]; return s; });
    denom = vP(denom); rows = rows.map(vP);
  }
  chart = makeChartFromData({
    stateDim: 6, denom, rows: rows as [number[], number[], number[]],
    label: pj.label ?? 'preset', pretty: 'preset view',
  });
} else {
  log(`[sp6-c32-hull] pilot BFS depth=${Math.min(PILOT_DEPTH, DEPTH)} for chart fit + bbox...`);
  pilot = generateOrbit(U_ACTION, bp.basepoint, Math.min(PILOT_DEPTH, DEPTH));
  const c = fitPCAChartEmbeddingWithDenom(pilot, [1, 0, 0, 0, 0, 0], 'c32-hull', 'dominant-denom PCA (y₀=1)');
  if (!c) { log('[sp6-c32-hull] chart fit failed'); process.exit(1); }
  chart = c;
}

// Embed the rays → R³ (hull vertices live here, before the camera).
const scratch3 = new Float64Array(3);
const rayBuf = new Float64Array(6);
const rayR3: { x: number; y: number; z: number }[] = [];
for (let k = 0; k < RAYS.length; k++) {
  let s = 0; for (let i = 0; i < 6; i++) { rayBuf[i] = RAYS[k][i]; s += rayBuf[i] * rayBuf[i]; }
  const inv = 1 / Math.sqrt(s); for (let i = 0; i < 6; i++) rayBuf[i] *= inv;
  if (chart.embed(rayBuf, 0, scratch3, 0)) rayR3.push({ x: scratch3[0], y: scratch3[1], z: scratch3[2] });
}
log(`[sp6-c32-hull] rays embedded: ${rayR3.length}/${RAYS.length}`);

// Camera: preset perspective, or orthographic autofit over rays ∪ clipped Λ.
let imgW: number, imgH: number, camera: Camera;
if (PRESET) {
  const d = resolveImageDims(PRESET.viewport.width / PRESET.viewport.height, MAX_DIM, { minDim: MIN_DIM, dimRound: DIM_ROUND });
  imgW = d.imgW; imgH = d.imgH;
  const c = PRESET.camera;
  // Dolly the eye along the (eye − target) ray by ZOOM (1 = exact preset).
  const position = [0, 1, 2].map((i) => c.target[i] + (c.position[i] - c.target[i]) * ZOOM) as [number, number, number];
  camera = makePerspectiveCamera({ ...c, position, imgW, imgH });
  log(`[sp6-c32-hull] preset perspective fov=${c.fov}° zoom=${ZOOM} → ${imgW}×${imgH}`);
} else {
  let xLo = Infinity, xHi = -Infinity, yLo = Infinity, yHi = -Infinity;
  const grow = (x: number, y: number): void => {
    if (x < xLo) xLo = x; if (x > xHi) xHi = x; if (y < yLo) yLo = y; if (y > yHi) yHi = y;
  };
  for (const p of rayR3) grow(p.x, p.y);
  for (let i = 0; i < pilot!.count; i++) {
    const off = i * 6;
    if (CLIP_TO_CONE && !inConeU(pilot!.vecs, off)) continue;
    if (chart.embed(pilot!.vecs, off, scratch3, 0)) grow(scratch3[0], scratch3[1]);
  }
  const mx = (xHi - xLo) * MARGIN, my = (yHi - yLo) * MARGIN;
  xLo -= mx; xHi += mx; yLo -= my; yHi += my;
  const d = resolveImageDims((xHi - xLo) / (yHi - yLo), MAX_DIM, { minDim: MIN_DIM, dimRound: DIM_ROUND });
  imgW = d.imgW; imgH = d.imgH;
  camera = makeOrthographicCamera({ xLo, xHi, yLo, yHi, imgW, imgH });
  log(`[sp6-c32-hull] autofit bbox [${xLo.toFixed(2)},${xHi.toFixed(2)}]×[${yLo.toFixed(2)},${yHi.toFixed(2)}] → ${imgW}×${imgH}`);
}
const projector = composeProjector(chart, camera);

// ─── Limit-set layer: stream DFS → accumulator → tone → RGBA ────────────────

const acc = createAccumulator(imgW, imgH, 1);
const deposit = makeIntegerDeposit(acc.data, imgW, imgH, 1);
const total = 1 + 2 * (Math.pow(3, DEPTH) - 1);
let drawn = 0;
const prog = createProgress({ total, label: 'DFS', extra: () => `drawn ${formatCount(drawn)}` });
streamOrbit(U_ACTION, bp.basepoint, DEPTH, (vecs, off) => {
  prog.tick();
  if (CLIP_TO_CONE && !inConeU(vecs, off)) return;
  const p = projector(vecs, off);
  if (p && deposit(p.px, p.py, 0)) drawn++;
});
prog.done();
log(`[sp6-c32-hull] DFS visited ${prog.count.toLocaleString()}  drawn ${drawn.toLocaleString()}  in ${prog.elapsed.toFixed(1)}s`);

const { rgba } = accumulatorToRGBA(acc, { percentile: TONE_PERCENTILE, bg: BG, gamma: TONE_GAMMA });

// ─── Hull box overlay ───────────────────────────────────────────────────────

const verts3 = rayR3.map((p) => new Vector3(p.x, p.y, p.z));
const idxOf = new Map<Vector3, number>();
verts3.forEach((v, i) => idxOf.set(v, i));
const hull = new ConvexHull().setFromPoints(verts3);

// Project ray R³ → pixels via the active camera (ortho or perspective);
// vertices outside the frame project to null and their primitives are skipped.
const pix = rayR3.map((p) => camera.project(p.x, p.y, p.z));

// Walk the hull: collect triangles, and edges filtered by adjacent-face angle
// (drop coplanar triangulation diagonals — keep only true polytope edges).
const faces: [number, number, number][] = [];
const edgeSeen = new Set<string>();
const edges: [number, number][] = [];
const vertSet = new Set<number>();
for (const f of hull.faces) {
  const vs: number[] = [];
  let e = f.edge;
  do { vs.push(idxOf.get(e.head().point)!); e = e.next; } while (e !== f.edge);
  for (let i = 1; i + 1 < vs.length; i++) faces.push([vs[0], vs[i], vs[i + 1]]);
  e = f.edge;
  do {
    const a = idxOf.get(e.tail().point)!, b = idxOf.get(e.head().point)!;
    vertSet.add(a); vertSet.add(b);
    const key = a < b ? `${a}_${b}` : `${b}_${a}`;
    if (!edgeSeen.has(key)) {
      edgeSeen.add(key);
      const n1 = f.normal, n2 = e.twin.face.normal;
      if (n1.x * n2.x + n1.y * n2.y + n1.z * n2.z < EDGE_COPLANAR_DOT) edges.push([a, b]);
    }
    e = e.next;
  } while (e !== f.edge);
}
log(`[sp6-c32-hull] hull: ${vertSet.size} verts, ${faces.length} triangles, ${edges.length} edges`);

// Faces (translucent), then edges (lines), then vertex corners (dots).
// Primitives with any off-screen vertex are skipped.
for (const [a, b, c] of faces) {
  const pa = pix[a], pb = pix[b], pc = pix[c];
  if (!pa || !pb || !pc) continue;
  fillTriangleAlpha(rgba, imgW, imgH, pa.px, pa.py, pb.px, pb.py, pc.px, pc.py, FACE_COLOR, FACE_ALPHA);
}
// Thick stroke = a fan of 1px AA lines offset along the segment's normal.
// Offsets step ~0.85px (sub-pixel ⇒ the AA fringes overlap into a solid band)
// and the per-line opacity is divided down so stacked coverage lands near the
// target EDGE_OPACITY rather than piling up to opaque.
function strokeThick(x0: number, y0: number, x1: number, y1: number): void {
  const dx = x1 - x0, dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  if (EDGE_WIDTH_PX <= 1.5 || len === 0) {
    drawLineAA(rgba, imgW, imgH, x0, y0, x1, y1, EDGE_COLOR, EDGE_OPACITY);
    return;
  }
  const nx = -dy / len, ny = dx / len;   // unit normal
  const half = (EDGE_WIDTH_PX - 1) / 2;
  const step = 0.85;
  const n = Math.max(1, Math.ceil((2 * half) / step));
  const op = 1 - Math.pow(1 - EDGE_OPACITY, 1 / (n + 1));   // composite ≈ EDGE_OPACITY
  for (let i = 0; i <= n; i++) {
    const t = -half + (i / n) * (2 * half);
    const ox = nx * t, oy = ny * t;
    drawLineAA(rgba, imgW, imgH, x0 + ox, y0 + oy, x1 + ox, y1 + oy, EDGE_COLOR, op);
  }
}
for (const [a, b] of edges) {
  const pa = pix[a], pb = pix[b];
  if (!pa || !pb) continue;
  strokeThick(pa.px, pa.py, pb.px, pb.py);
}
// Solid AA disk: full color inside the radius, a 1px feathered rim composited
// over whatever is there so big corner dots don't look stair-stepped.
const R = VERTEX_RADIUS_PX;
const span = Math.ceil(R + 1);
for (const v of vertSet) {
  const pv = pix[v];
  if (!pv) continue;
  for (let dy = -span; dy <= span; dy++) {
    for (let dx = -span; dx <= span; dx++) {
      const d = Math.hypot(dx, dy);
      const cov = Math.min(1, Math.max(0, R + 0.5 - d));   // 1 inside, ramps to 0 at rim
      if (cov <= 0) continue;
      const x = Math.round(pv.px) + dx, y = Math.round(pv.py) + dy;
      if (x < 0 || x >= imgW || y < 0 || y >= imgH) continue;
      const idx = (y * imgW + x) * 4;
      rgba[idx]     = Math.round(rgba[idx]     * (1 - cov) + VERTEX_COLOR[0] * cov);
      rgba[idx + 1] = Math.round(rgba[idx + 1] * (1 - cov) + VERTEX_COLOR[1] * cov);
      rgba[idx + 2] = Math.round(rgba[idx + 2] * (1 - cov) + VERTEX_COLOR[2] * cov);
      rgba[idx + 3] = 255;
    }
  }
}

// ─── Write PNG ──────────────────────────────────────────────────────────────

const clipTag = CLIP_TO_CONE ? '-coneclip' : '-full';
const outputFile = `c32-hull-depth${DEPTH}-${imgW}x${imgH}${clipTag}.png`;
log(`[sp6-c32-hull] writing ${outputFile}...`);
await writePng(outputFile, imgW, imgH, rgba);
log('[sp6-c32-hull] done.');
