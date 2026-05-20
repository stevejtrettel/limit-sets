/**
 * sp6-render-limit-set.ts
 *
 * Offline density-image render of an Sp(6,Z) limit set.
 *
 * Two phases:
 *   1. accumulate — stream the non-backtracking word tree by DFS (so memory is
 *      O(depth), not O(orbit size)), project each visited point through a chart
 *      (auto-PCA or preset camera) into pixel space, integer-deposit into an
 *      accumulator grid. Cache the grid to scripts/cache/<key>.acc for reuse.
 *   2. render — read the accumulator, log-tone-curve with percentile clip,
 *      write PNG.
 *
 * Re-runs with the same example/depth/view/image-size/color-scheme hit the
 * accumulator cache and skip phase 1. Background color, tone curve, and gamma
 * are render-only — flipping them re-uses the cached accumulator.
 *
 *   node scripts/sp6-render-limit-set.ts [depth] [flags...]
 *
 * Two render modes:
 *   - Default: PCA on a pilot orbit + percentile-bbox autofit (orthographic).
 *   - VIEW_PRESET: paste a JSON bundle from `npm run dev sp6-limit-sets-render`
 *     (the demo's "save view" button writes scripts/view-preset.json) to
 *     render the exact perspective view at higher depth.
 *
 * All sp6 group math (applyGen, basepoint, PCA, etc.) is imported from
 * `src/sp6/`. Rendering pieces (accumulator format, tone curve, PNG, progress)
 * live in `src/render/`.
 */

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

import {
  createAccumulator,
  writeAccumulatorFile,
  readAccumulatorFile,
  type Accumulator,
} from '../src/render/accumulator.ts';
import { accumulatorToRGBA, type Bg, type Palette } from '../src/render/tone.ts';
import { writePng } from '../src/render/png.ts';
import { createProgress, formatCount } from '../src/render/progress.ts';
import { getScheme } from '../src/render/colorScheme.ts';
import { paletteForScheme } from '../src/sp6/palettes.ts';

import {
  exampleById,
  type ExampleGroup,
} from '../src/sp6/examples.ts';
import {
  INV,
  makeGroupAction,
  computeProximalBasepoint,
  generateOrbit,
  normalize6InPlace,
  type GroupAction,
} from '../src/sp6/orbit.ts';
import {
  fitAutoChartProjection,
  type Projection,
} from '../src/sp6/projection.ts';

// ─── EDITABLE ───────────────────────────────────────────────────────────────

// Pick which BDN example to render. Ignored when VIEW_PRESET is set
// (the preset's exampleId wins).
const EXAMPLE_ID = 'c32'; // 'A1' | 'A15' | 'c2' | 'c32' | 'c47' | 'c55'

// Orbit
const DEFAULT_DEPTH    = 13;
let   DEPTH            = DEFAULT_DEPTH;
// Pilot BFS for auto-mode (PCA + bbox). Capped at DEPTH so low-depth runs
// don't do extra work; auto-mode at depth > PILOT_DEPTH uses the pilot's
// projection for the full streaming pass.
const PILOT_DEPTH      = 12;

// Image — long side fixed, short side derived from view aspect.
let   MAX_DIM          = 8192;
const MIN_DIM          = 128;
const DIM_ROUND        = 16;

// Auto-mode framing
const BBOX_TRIM        = 0.20;
const MAX_ASPECT       = 4;
const FIT_FILL         = 0.92;

// Tone-map (render phase only — does not invalidate cache)
let   TONE_PERCENTILE  = 0.999;
let   BG: Bg           = 'white';
let   TONE_GAMMA       = 1;

// Color scheme — selects which categorical bucket each point goes to.
//   'grayscale'      K=1, mono path (fastest, lowest memory)
//   'last-gen'       K=5, color by last letter (basepoint = cat 0)
//   'kth-last:k'     K=5, color by k-th to last letter
let   COLOR_SCHEME     = 'grayscale';

// ─── View preset ────────────────────────────────────────────────────────────

interface ViewPreset {
  exampleId?: string;
  previewDepth?: number;
  colorScheme?: string;
  projection: {
    denom: number[];
    rowX: number[];
    rowY: number[];
    rowZ: number[];
    label?: string;
  };
  camera: {
    position: [number, number, number];
    target: [number, number, number];
    up: [number, number, number];
    fov: number;
    aspect: number;
    near: number;
    far: number;
  };
  viewport: { width: number; height: number };
}

let VIEW_PRESET: ViewPreset | null = null;
const VIEW_PRESET_PATH = fileURLToPath(new URL('./view-preset.json', import.meta.url));
if (existsSync(VIEW_PRESET_PATH)) {
  try {
    VIEW_PRESET = JSON.parse(readFileSync(VIEW_PRESET_PATH, 'utf8'));
    process.stderr.write(`[sp6-render] loaded view-preset.json` +
      ` (exampleId=${VIEW_PRESET!.exampleId}, previewDepth=${VIEW_PRESET!.previewDepth})\n`);
  } catch (e) {
    process.stderr.write(`[sp6-render] WARNING: ignoring malformed view-preset.json: ${(e as Error).message}\n`);
    VIEW_PRESET = null;
  }
}

// If the preset carries a colorScheme, use it as the new default. --color-scheme
// on the CLI still overrides this later.
if (VIEW_PRESET && typeof VIEW_PRESET.colorScheme === 'string') {
  try {
    getScheme(VIEW_PRESET.colorScheme);
    COLOR_SCHEME = VIEW_PRESET.colorScheme;
    process.stderr.write(`[sp6-render] preset color-scheme: ${COLOR_SCHEME}\n`);
  } catch (e) {
    process.stderr.write(`[sp6-render] ignoring preset.colorScheme=${VIEW_PRESET.colorScheme}: ${(e as Error).message}\n`);
  }
}

// ─── Active example ────────────────────────────────────────────────────────

const ACTIVE_ID = VIEW_PRESET?.exampleId ?? EXAMPLE_ID;
const ACTIVE: ExampleGroup = exampleById(ACTIVE_ID);

// ─── 4×4 matrix math (for VIEW_PRESET camera) ──────────────────────────────

function mat4Mul(a: Float64Array, b: Float64Array): Float64Array {
  const m = new Float64Array(16);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[r * 4 + k] * b[k * 4 + c];
      m[r * 4 + c] = s;
    }
  }
  return m;
}

function mat4LookAt(eye: number[], target: number[], up: number[]): Float64Array {
  const fx = target[0] - eye[0], fy = target[1] - eye[1], fz = target[2] - eye[2];
  const fl = Math.hypot(fx, fy, fz);
  const f0 = fx / fl, f1 = fy / fl, f2 = fz / fl;
  let s0 = f1 * up[2] - f2 * up[1];
  let s1 = f2 * up[0] - f0 * up[2];
  let s2 = f0 * up[1] - f1 * up[0];
  const sl = Math.hypot(s0, s1, s2);
  s0 /= sl; s1 /= sl; s2 /= sl;
  const u0 = s1 * f2 - s2 * f1;
  const u1 = s2 * f0 - s0 * f2;
  const u2 = s0 * f1 - s1 * f0;
  const m = new Float64Array(16);
  m[0]  = s0;  m[1]  = s1;  m[2]  = s2;  m[3]  = -(s0 * eye[0] + s1 * eye[1] + s2 * eye[2]);
  m[4]  = u0;  m[5]  = u1;  m[6]  = u2;  m[7]  = -(u0 * eye[0] + u1 * eye[1] + u2 * eye[2]);
  m[8]  = -f0; m[9]  = -f1; m[10] = -f2; m[11] =  (f0 * eye[0] + f1 * eye[1] + f2 * eye[2]);
  m[15] = 1;
  return m;
}

function mat4Perspective(fovDeg: number, aspect: number, near: number, far: number): Float64Array {
  const f = 1 / Math.tan((fovDeg * Math.PI / 180) / 2);
  const nf = 1 / (near - far);
  const m = new Float64Array(16);
  m[0]  = f / aspect;
  m[5]  = f;
  m[10] = (far + near) * nf;
  m[11] = 2 * far * near * nf;
  m[14] = -1;
  return m;
}

// ─── Streaming DFS ─────────────────────────────────────────────────────────
//
// Visit every non-backtracking word of length ≤ N depth-first. Memory =
// (N+1)*6 doubles for the stack, plus 2*(N+1) bytes of stack bookkeeping.
// Independent of orbit size.
//
// `onNode(vecs, off, depth, lastGenStack)` is called once per visited node,
// including the basepoint (depth 0).

type DfsCallback = (
  vecs: Float64Array,
  off: number,
  depth: number,
  lastGenStack: Uint8Array,
) => void;

function streamDfs(
  N: number,
  basepoint: Float64Array,
  action: GroupAction,
  onNode: DfsCallback,
): void {
  const vecs = new Float64Array((N + 1) * 6);
  const lastGenStack = new Uint8Array(N + 1);
  const childStack   = new Uint8Array(N + 1);
  for (let i = 0; i < 6; i++) vecs[i] = basepoint[i];
  lastGenStack[0] = 255; // basepoint sentinel
  childStack[0]   = 0;

  onNode(vecs, 0, 0, lastGenStack);

  let d = 0;
  while (d >= 0) {
    if (d >= N) { d--; continue; }
    const pLast = lastGenStack[d];
    let g = childStack[d];
    while (g < 4 && pLast < 4 && g === INV[pLast]) g++;
    if (g >= 4) { d--; continue; }
    childStack[d] = g + 1;
    const dOff = (d + 1) * 6;
    action.applyGen(g, vecs, d * 6, vecs, dOff);
    normalize6InPlace(vecs, dOff);
    d++;
    lastGenStack[d] = g;
    childStack[d]   = 0;
    onNode(vecs, dOff, d, lastGenStack);
  }
}

// ─── argv parsing ──────────────────────────────────────────────────────────

const log = (msg: string): void => { process.stderr.write(msg + '\n'); };

const ARGS = process.argv.slice(2);
const FORCE_REFRESH = ARGS.includes('--refresh') || ARGS.includes('--no-cache');

function flagValue(name: string): string | null {
  const i = ARGS.indexOf(name);
  return i >= 0 && i + 1 < ARGS.length ? ARGS[i + 1] : null;
}

function applyFloat(
  name: string,
  set: (n: number) => void,
  predicate: (n: number) => boolean = (n) => Number.isFinite(n) && n > 0,
): void {
  const v = flagValue(name); if (v === null) return;
  const n = parseFloat(v);
  if (predicate(n)) set(n); else log(`[sp6-render] ignoring ${name}=${v} (invalid)`);
}
function applyInt(
  name: string,
  set: (n: number) => void,
  predicate: (n: number) => boolean = (n) => Number.isFinite(n) && n > 0,
): void {
  const v = flagValue(name); if (v === null) return;
  const n = parseInt(v, 10);
  if (predicate(n)) set(n); else log(`[sp6-render] ignoring ${name}=${v} (invalid)`);
}

applyInt(  '--max-dim', (n) => { MAX_DIM = n; }, (n) => Number.isFinite(n) && n >= 256);
applyFloat('--tone',    (n) => { TONE_PERCENTILE = n; }, (n) => Number.isFinite(n) && n > 0 && n <= 1);
applyFloat('--gamma',   (n) => { TONE_GAMMA = n; }, (n) => Number.isFinite(n) && n > 0);
{
  const v = flagValue('--color-scheme');
  if (v !== null) {
    try { getScheme(v); COLOR_SCHEME = v; }
    catch (e) { log(`[sp6-render] ignoring --color-scheme=${v} (${(e as Error).message})`); }
  }
}
{
  const v = flagValue('--bg');
  if (v === 'white' || v === 'black') BG = v;
  else if (v !== null) log(`[sp6-render] ignoring --bg=${v} (expected "white" or "black")`);
}

const VALUE_FLAGS = new Set(['--max-dim', '--tone', '--gamma', '--color-scheme', '--bg']);
const skipIdx = new Set<number>();
for (let i = 0; i < ARGS.length; i++) if (VALUE_FLAGS.has(ARGS[i])) skipIdx.add(i + 1);
const depthArg = ARGS.find((a, i) => !a.startsWith('--') && !skipIdx.has(i));

if (depthArg !== undefined) {
  const n = parseInt(depthArg, 10);
  if (Number.isFinite(n) && n >= 1) {
    DEPTH = n;
    log(`[sp6-render] depth=${DEPTH} (from command line)`);
  } else {
    log(`[sp6-render] ignoring non-integer depth arg "${depthArg}"`);
  }
}
if (DEPTH === DEFAULT_DEPTH && depthArg === undefined && process.stdin.isTTY) {
  const { createInterface } = await import('node:readline/promises');
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question(`BFS depth [default ${DEFAULT_DEPTH}]: `)).trim();
  rl.close();
  if (answer !== '') {
    const n = parseInt(answer, 10);
    if (Number.isFinite(n) && n >= 1) DEPTH = n;
    else log(`[sp6-render] invalid depth "${answer}", using default ${DEFAULT_DEPTH}`);
  }
}

// ─── Banner ────────────────────────────────────────────────────────────────

log(`[sp6-render] example=${ACTIVE.label} (${ACTIVE_ID})` +
    (VIEW_PRESET ? ' — from VIEW_PRESET' : ' — from EXAMPLE_ID'));
log(`[sp6-render] depth=${DEPTH}, max dim=${MAX_DIM}, ` +
    `tone=${TONE_PERCENTILE}, gamma=${TONE_GAMMA}, bg=${BG}, color=${COLOR_SCHEME}`);

const tStart = Date.now();

// ─── Cache key ─────────────────────────────────────────────────────────────

const CACHE_DIR = fileURLToPath(new URL('./cache/', import.meta.url));

function hashJson(obj: unknown): string {
  return createHash('sha1').update(JSON.stringify(obj)).digest('hex').slice(0, 16);
}

function buildCacheKey(): string {
  // Note: bg and tone-curve params are render-only — they're NOT in the key.
  // The accumulator stores raw category counts; bg/tone are applied later.
  const keyObj: Record<string, unknown> = {
    exampleId: ACTIVE_ID,
    depth: DEPTH,
    maxDim: MAX_DIM,
    colorScheme: COLOR_SCHEME,
  };
  if (VIEW_PRESET) {
    keyObj.mode = 'preset';
    keyObj.preset = {
      projection: VIEW_PRESET.projection,
      camera:     VIEW_PRESET.camera,
      viewport:   VIEW_PRESET.viewport,
    };
  } else {
    keyObj.mode = 'auto';
  }
  return hashJson(keyObj);
}

const cacheKey  = buildCacheKey();
const cachePath = `${CACHE_DIR}${ACTIVE_ID}-depth${DEPTH}-${cacheKey}.acc`;

// ─── Resolve view + dimensions ─────────────────────────────────────────────

type Projector = (state: Float64Array, off: number) => { px: number; py: number } | null;

const roundDim = (d: number): number =>
  Math.max(MIN_DIM, Math.round(d / DIM_ROUND) * DIM_ROUND);

let imgW = 0, imgH = 0;
let projector!: Projector;
let outputSuffix = '';

function makePresetProjector(): Projector {
  const cam = VIEW_PRESET!.camera;
  const vp  = VIEW_PRESET!.viewport;
  const aspect = vp.width / vp.height;
  if (aspect >= 1) { imgW = roundDim(MAX_DIM); imgH = roundDim(MAX_DIM / aspect); }
  else             { imgH = roundDim(MAX_DIM); imgW = roundDim(MAX_DIM * aspect); }
  outputSuffix = '-view';
  log(`Using exported camera (fov=${cam.fov}°, aspect=${aspect.toFixed(3)})  →  image = ${imgW}×${imgH}`);

  const VPmat = mat4Mul(
    mat4Perspective(cam.fov, imgW / imgH, cam.near, cam.far),
    mat4LookAt(cam.position, cam.target, cam.up),
  );
  const proj = VIEW_PRESET!.projection;
  const d0=proj.denom[0], d1=proj.denom[1], d2=proj.denom[2], d3=proj.denom[3], d4=proj.denom[4], d5=proj.denom[5];
  const x0=proj.rowX[0],  x1=proj.rowX[1],  x2=proj.rowX[2],  x3=proj.rowX[3],  x4=proj.rowX[4],  x5=proj.rowX[5];
  const y0=proj.rowY[0],  y1=proj.rowY[1],  y2=proj.rowY[2],  y3=proj.rowY[3],  y4=proj.rowY[4],  y5=proj.rowY[5];
  const z0=proj.rowZ[0],  z1=proj.rowZ[1],  z2=proj.rowZ[2],  z3=proj.rowZ[3],  z4=proj.rowZ[4],  z5=proj.rowZ[5];
  const VP = VPmat;
  const W = imgW, H = imgH;
  return function project(s, o) {
    const va = s[o],     vb = s[o + 1], vc = s[o + 2];
    const vd = s[o + 3], ve = s[o + 4], vf = s[o + 5];
    const dv = d0*va + d1*vb + d2*vc + d3*vd + d4*ve + d5*vf;
    if (Math.abs(dv) < 1e-4) return null;
    const inv = 1 / dv;
    const wx = (x0*va + x1*vb + x2*vc + x3*vd + x4*ve + x5*vf) * inv;
    const wy = (y0*va + y1*vb + y2*vc + y3*vd + y4*ve + y5*vf) * inv;
    const wz = (z0*va + z1*vb + z2*vc + z3*vd + z4*ve + z5*vf) * inv;
    const cx = VP[0] *wx + VP[1] *wy + VP[2] *wz + VP[3];
    const cy = VP[4] *wx + VP[5] *wy + VP[6] *wz + VP[7];
    const cz = VP[8] *wx + VP[9] *wy + VP[10]*wz + VP[11];
    const cw = VP[12]*wx + VP[13]*wy + VP[14]*wz + VP[15];
    if (cw <= 0) return null;
    const invW = 1 / cw;
    const nz = cz * invW;
    if (nz < -1 || nz > 1) return null;
    const px = (cx * invW + 1) * 0.5 * W;
    const py = (1 - cy * invW) * 0.5 * H;
    if (px < 0 || px >= W || py < 0 || py >= H) return null;
    return { px, py };
  };
}

function makeAutoProjector(action: GroupAction, basepoint: Float64Array): Projector {
  // Pilot BFS → PCA chart → percentile bbox of (x, y). Uses the shared
  // in-memory generateOrbit from src/sp6/orbit.ts.
  const pilotDepth = Math.min(DEPTH, PILOT_DEPTH);
  log(`Pilot BFS (depth ${pilotDepth}) for PCA + bbox...`);
  const tp = Date.now();
  const pilot = generateOrbit(action, basepoint, pilotDepth);
  log(`  pilot BFS in ${Date.now() - tp} ms, ${pilot.count.toLocaleString()} nodes`);

  log('Fitting auto-chart projective PCA on pilot orbit...');
  const tc = Date.now();
  const proj: Projection = fitAutoChartProjection(pilot);
  log(`  PCA done in ${Date.now() - tc} ms`);

  // Project pilot points to compute the percentile bbox.
  log('Computing autofit bbox from pilot orbit...');
  const tb = Date.now();
  const denom = proj.denom;
  const rowX  = proj.rows[0];
  const rowY  = proj.rows[1];
  const xs = new Float32Array(pilot.count);
  const ys = new Float32Array(pilot.count);
  let kept = 0;
  for (let i = 0; i < pilot.count; i++) {
    const o = i * 6;
    const va = pilot.vecs[o],     vb = pilot.vecs[o + 1], vc = pilot.vecs[o + 2];
    const vd = pilot.vecs[o + 3], ve = pilot.vecs[o + 4], vf = pilot.vecs[o + 5];
    const dv = denom[0]*va + denom[1]*vb + denom[2]*vc + denom[3]*vd + denom[4]*ve + denom[5]*vf;
    if (Math.abs(dv) < 1e-4) continue;
    const inv = 1 / dv;
    xs[kept] = (rowX[0]*va + rowX[1]*vb + rowX[2]*vc + rowX[3]*vd + rowX[4]*ve + rowX[5]*vf) * inv;
    ys[kept] = (rowY[0]*va + rowY[1]*vb + rowY[2]*vc + rowY[3]*vd + rowY[4]*ve + rowY[5]*vf) * inv;
    kept++;
  }
  const percentile = (arr: Float32Array, n: number, p: number): number => {
    const tmp = arr.slice(0, n);
    tmp.sort();
    const idx = Math.max(0, Math.min(n - 1, Math.floor(n * p)));
    return tmp[idx];
  };
  const xLo = percentile(xs, kept, BBOX_TRIM);
  const xHi = percentile(xs, kept, 1 - BBOX_TRIM);
  const yLo = percentile(ys, kept, BBOX_TRIM);
  const yHi = percentile(ys, kept, 1 - BBOX_TRIM);
  const xMed = percentile(xs, kept, 0.5);
  const yMed = percentile(ys, kept, 0.5);
  let halfX = Math.max(xMed - xLo, xHi - xMed) / FIT_FILL;
  let halfY = Math.max(yMed - yLo, yHi - yMed) / FIT_FILL;
  const bboxAspect = halfX / halfY;
  if (bboxAspect > MAX_ASPECT) halfX = halfY * MAX_ASPECT;
  else if (bboxAspect < 1 / MAX_ASPECT) halfY = halfX * MAX_ASPECT;
  const viewXLo = xMed - halfX, viewXHi = xMed + halfX;
  const viewYLo = yMed - halfY, viewYHi = yMed + halfY;
  const effAspect = halfX / halfY;
  if (effAspect >= 1) { imgW = roundDim(MAX_DIM); imgH = roundDim(MAX_DIM / effAspect); }
  else                { imgH = roundDim(MAX_DIM); imgW = roundDim(MAX_DIM * effAspect); }
  outputSuffix = '';
  log(`  bbox = [${xLo.toFixed(3)}, ${xHi.toFixed(3)}] × [${yLo.toFixed(3)}, ${yHi.toFixed(3)}]  ` +
      `aspect ${bboxAspect.toFixed(2)} (capped at ${MAX_ASPECT})  →  image = ${imgW}×${imgH}  ` +
      `in ${Date.now() - tb} ms`);

  const sx = imgW / (viewXHi - viewXLo);
  const sy = imgH / (viewYHi - viewYLo);
  const oyTop = viewYHi;
  const d0=denom[0], d1=denom[1], d2=denom[2], d3=denom[3], d4=denom[4], d5=denom[5];
  const x0=rowX[0],  x1=rowX[1],  x2=rowX[2],  x3=rowX[3],  x4=rowX[4],  x5=rowX[5];
  const y0=rowY[0],  y1=rowY[1],  y2=rowY[2],  y3=rowY[3],  y4=rowY[4],  y5=rowY[5];
  const W = imgW, H = imgH;
  return function project(s, o) {
    const va = s[o],     vb = s[o + 1], vc = s[o + 2];
    const vd = s[o + 3], ve = s[o + 4], vf = s[o + 5];
    const dv = d0*va + d1*vb + d2*vc + d3*vd + d4*ve + d5*vf;
    if (Math.abs(dv) < 1e-4) return null;
    const inv = 1 / dv;
    const wx = (x0*va + x1*vb + x2*vc + x3*vd + x4*ve + x5*vf) * inv;
    const wy = (y0*va + y1*vb + y2*vc + y3*vd + y4*ve + y5*vf) * inv;
    const px = (wx - viewXLo) * sx;
    const py = (oyTop - wy)   * sy;
    if (px < 0 || px >= W || py < 0 || py >= H) return null;
    return { px, py };
  };
}

// ─── Accumulate phase ──────────────────────────────────────────────────────

interface AccumulateResult { acc: Accumulator; visited: number; drawn: number; }

function accumulate(action: GroupAction, basepoint: Float64Array): AccumulateResult {
  if (VIEW_PRESET) projector = makePresetProjector();
  else             projector = makeAutoProjector(action, basepoint);

  const scheme = getScheme(COLOR_SCHEME);
  const K = scheme.categoryCount;
  const stepsBack = scheme.stepsBack;
  const acc = createAccumulator(imgW, imgH, K);

  const total = 1 + 2 * (Math.pow(3, DEPTH) - 1);
  log(`Streaming DFS depth=${DEPTH} → ${imgW}×${imgH}×${K} accumulator (${formatCount(total)} total nodes, scheme=${scheme.name})...`);

  let drawn = 0;
  const prog = createProgress({
    total,
    label: 'DFS',
    extra: () => `drawn ${formatCount(drawn)}`,
  });

  const W = imgW, H = imgH;
  const data = acc.data;

  if (K === 1) {
    streamDfs(DEPTH, basepoint, action, (vecs, off) => {
      prog.tick();
      const p = projector(vecs, off);
      if (p === null) return;
      const ix = Math.floor(p.px + 0.5);
      const iy = Math.floor(p.py + 0.5);
      if (ix < 0 || ix >= W || iy < 0 || iy >= H) return;
      data[iy * W + ix] += 1;
      drawn++;
    });
  } else {
    streamDfs(DEPTH, basepoint, action, (vecs, off, depth, lastGenStack) => {
      prog.tick();
      const p = projector(vecs, off);
      if (p === null) return;
      const ix = Math.floor(p.px + 0.5);
      const iy = Math.floor(p.py + 0.5);
      if (ix < 0 || ix >= W || iy < 0 || iy >= H) return;
      let cat: number;
      const d = depth - stepsBack;
      if (d < 1) {
        cat = 0;
      } else {
        const g = lastGenStack[d];
        cat = g > 3 ? 0 : g + 1;
      }
      data[(iy * W + ix) * K + cat] += 1;
      drawn++;
    });
  }
  prog.done();

  const visited = prog.count;
  log(`  DFS done: visited ${visited.toLocaleString()}  drawn ${drawn.toLocaleString()}  in ${prog.elapsed.toFixed(1)}s`);
  return { acc, visited, drawn };
}

// ─── Main pipeline ─────────────────────────────────────────────────────────

let acc: Accumulator | undefined;
let visited = 0, drawn = 0;
let loadedFromCache = false;

if (!FORCE_REFRESH && existsSync(cachePath)) {
  log(`Loading accumulator cache from ${cachePath}...`);
  const t = Date.now();
  try {
    const r = readAccumulatorFile(cachePath);
    acc = r.acc;
    imgW = acc.width;
    imgH = acc.height;
    outputSuffix = r.userMeta.mode === 'preset' ? '-view' : '';
    visited = (r.userMeta.visited as number | undefined) ?? 0;
    drawn   = (r.userMeta.drawn   as number | undefined) ?? 0;
    loadedFromCache = true;
    log(`  loaded ${imgW}×${imgH}×${acc.channels} in ${Date.now() - t} ms ` +
        `(drawn ${drawn.toLocaleString()} of ${visited.toLocaleString()} when generated)`);
  } catch (e) {
    log(`  cache load failed (${(e as Error).message}); recomputing.`);
  }
}

if (!loadedFromCache) {
  log('Computing proximal basepoint...');
  const action = makeGroupAction(ACTIVE);
  const bp = computeProximalBasepoint(ACTIVE, action);
  log(`Proximal basepoint: |λ_max(γ)| ≈ ${bp.lambdaMax.toFixed(3)}, drift = ${bp.drift.toFixed(4)}`);
  const r = accumulate(action, bp.basepoint);
  acc = r.acc; visited = r.visited; drawn = r.drawn;
  if (drawn > 0) {
    log(`Caching accumulator to ${cachePath}...`);
    const tw = Date.now();
    try {
      writeAccumulatorFile(cachePath, acc, {
        exampleId: ACTIVE_ID,
        depth: DEPTH,
        maxDim: MAX_DIM,
        colorScheme: COLOR_SCHEME,
        mode: VIEW_PRESET ? 'preset' : 'auto',
        visited,
        drawn,
        generatedAt: new Date().toISOString(),
      });
      const bytes = 8 + 256 + imgW * imgH * acc.channels * 4; // approx
      const sizeStr = bytes >= 1e9
        ? `${(bytes / 1e9).toFixed(2)} GB`
        : `${(bytes / 1e6).toFixed(1)} MB`;
      log(`  wrote ~${sizeStr} in ${Date.now() - tw} ms`);
    } catch (e) {
      log(`  cache write failed: ${(e as Error).message}  (continuing without cache)`);
    }
  }
}

if (!acc || (drawn === 0 && !loadedFromCache)) {
  log('Nothing to render. Exiting.');
  process.exit(1);
}

// ─── Render phase ──────────────────────────────────────────────────────────

log(`Tone-mapping (log + ${(TONE_PERCENTILE * 100).toFixed(1)}% percentile clip, gamma=${TONE_GAMMA}, ${BG} bg)...`);
const tt = Date.now();
const palette: Palette | undefined = acc.channels > 1 ? paletteForScheme(COLOR_SCHEME) : undefined;
const { rgba, scale } = accumulatorToRGBA(acc, {
  percentile: TONE_PERCENTILE,
  bg: BG,
  gamma: TONE_GAMMA,
  palette,
});
log(`  nonzero entries ${scale.nzCount.toLocaleString()}  clip = ${scale.clip.toFixed(3)}  in ${Date.now() - tt} ms`);

const outputFile = `${ACTIVE_ID}-depth${DEPTH}-${imgW}x${imgH}${outputSuffix}.png`;
log(`Writing ${outputFile}...`);
const te = Date.now();
await writePng(outputFile, imgW, imgH, rgba);
log(`  wrote PNG in ${Date.now() - te} ms`);

log(`Done — total ${((Date.now() - tStart) / 1000).toFixed(1)}s`);
