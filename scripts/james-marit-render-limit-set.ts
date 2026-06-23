/**
 * james-marit-render-limit-set.ts
 *
 * Offline density-image render of the james-marit limit set in RP³.
 *
 * Unlike sl4r-render (which looks up a hardcoded example by id), this
 * script consumes a self-contained `scripts/james-marit-view-preset.json`
 * — the demo's "copy view JSON" button writes the live 4×4 generators,
 * γ word, projection, and camera into that file, and this script renders
 * exactly what was on screen at higher resolution and depth.
 *
 *   node scripts/james-marit-render-limit-set.ts [depth] [flags...]
 *
 *   --max-dim N             long-side image dim (default 8192)
 *   --color-scheme <spec>   'grayscale' | 'last-gen' | 'kth-last:k'
 *   --bg white|black        default white
 *   --tone <p>              percentile clip in (0, 1]; default 0.999
 *   --gamma <g>             >0; reshape tone via t^(1/g)
 *   --splat N               integer ≥0; tent-splat radius (points only,
 *                           lines stay 1-pixel-thin)
 *   --line-opacity p        per-pixel weight in rays/both modes
 *                           (0, 1]; default 0.2
 *   --refresh               ignore the .acc cache
 *
 * Workflow: in the browser demo, tune the view, press "copy view JSON for
 * offline render", then run this script.
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
import { outputPath } from '../src/render/outputPath.ts';
import {
  drawText, measureText, fillRect, pickFontSize, type TextStyle,
} from '../src/render/textOverlay.ts';
import { createProgress, formatCount } from '../src/render/progress.ts';
import { getScheme } from '../src/render/colorScheme.ts';
import {
  type DepositFn,
  makeIntegerDeposit, makeTentSplatDeposit,
} from '../src/render/splat.ts';

import { makeMat4Action, type Mat4R } from '../src/sl4r/action.ts';
import { embeddingFromPreset } from '../src/sl4r/embedding.ts';
import { paletteForScheme } from '../src/sl4r/palettes.ts';

import type { GroupAction } from '../src/core/group.ts';
import {
  computeProximalBasepoint,
  streamOrbit,
  totalNodes,
} from '../src/core/orbit.ts';
import { type Projector } from '../src/core/scene.ts';
import { makePresetProjector } from '../src/core/projector.ts';
import type { JMViewPreset, JMRenderMode } from '../demos/james-marit/viewPreset.ts';

// ─── Defaults ──────────────────────────────────────────────────────────────

const DEFAULT_DEPTH = 13;

let MAX_DIM   = 8192;
const MIN_DIM = 128;
const DIM_ROUND = 16;

let TONE_PERCENTILE = 0.999;
let BG: Bg          = 'white';
let TONE_GAMMA      = 1;

let COLOR_SCHEME = 'grayscale';
let DEPTH        = DEFAULT_DEPTH;
let SPLAT_RADIUS = 0;
let RENDER_MODE: JMRenderMode = 'points';
/** Per-pixel weight for rays. Lower → fainter lines. */
let LINE_OPACITY = 0.2;

// ─── Load view preset (required) ───────────────────────────────────────────

const log = (msg: string): void => { process.stderr.write(msg + '\n'); };

const VIEW_PRESET_PATH = fileURLToPath(
  new URL('./james-marit-view-preset.json', import.meta.url),
);
if (!existsSync(VIEW_PRESET_PATH)) {
  log(`[james-marit-render] missing ${VIEW_PRESET_PATH}`);
  log(`    Open the james-marit demo in the browser, tune the view, then press`);
  log(`    "copy view JSON for offline render" — that writes this file.`);
  process.exit(1);
}

let VIEW_PRESET: JMViewPreset;
try {
  VIEW_PRESET = JSON.parse(readFileSync(VIEW_PRESET_PATH, 'utf8')) as JMViewPreset;
} catch (e) {
  log(`[james-marit-render] failed to parse view preset: ${(e as Error).message}`);
  process.exit(1);
}

if (
  !Array.isArray(VIEW_PRESET.generators) ||
  VIEW_PRESET.generators.length === 0
) {
  log(`[james-marit-render] view preset has no generators — was it written by an old demo?`);
  process.exit(1);
}

if (typeof VIEW_PRESET.colorScheme === 'string') {
  try {
    getScheme(VIEW_PRESET.colorScheme);
    COLOR_SCHEME = VIEW_PRESET.colorScheme;
  } catch (e) {
    log(`[james-marit-render] ignoring preset.colorScheme=${VIEW_PRESET.colorScheme}: ${(e as Error).message}`);
  }
}
if (
  VIEW_PRESET.renderMode === 'points' ||
  VIEW_PRESET.renderMode === 'rays'   ||
  VIEW_PRESET.renderMode === 'both'
) {
  RENDER_MODE = VIEW_PRESET.renderMode;
}
DEPTH = VIEW_PRESET.previewDepth ?? DEFAULT_DEPTH;

log(`[james-marit-render] loaded james-marit-view-preset.json` +
    ` (generators=${VIEW_PRESET.generators.length}, γ=${VIEW_PRESET.gammaName}, previewDepth=${VIEW_PRESET.previewDepth})`);

// ─── argv parsing ──────────────────────────────────────────────────────────

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
  if (predicate(n)) set(n); else log(`[james-marit-render] ignoring ${name}=${v} (invalid)`);
}
function applyInt(
  name: string,
  set: (n: number) => void,
  predicate: (n: number) => boolean = (n) => Number.isFinite(n) && n > 0,
): void {
  const v = flagValue(name); if (v === null) return;
  const n = parseInt(v, 10);
  if (predicate(n)) set(n); else log(`[james-marit-render] ignoring ${name}=${v} (invalid)`);
}

applyInt(  '--max-dim', (n) => { MAX_DIM = n; }, (n) => Number.isFinite(n) && n >= 256);
applyInt(  '--splat',   (n) => { SPLAT_RADIUS = n; }, (n) => Number.isFinite(n) && n >= 0 && n <= 8);
applyFloat('--tone',    (n) => { TONE_PERCENTILE = n; }, (n) => Number.isFinite(n) && n > 0 && n <= 1);
applyFloat('--gamma',   (n) => { TONE_GAMMA = n; }, (n) => Number.isFinite(n) && n > 0);
applyFloat('--line-opacity', (n) => { LINE_OPACITY = n; }, (n) => Number.isFinite(n) && n > 0 && n <= 1);
{
  const v = flagValue('--color-scheme');
  if (v !== null) {
    try { getScheme(v); COLOR_SCHEME = v; }
    catch (e) { log(`[james-marit-render] ignoring --color-scheme=${v} (${(e as Error).message})`); }
  }
}
{
  const v = flagValue('--bg');
  if (v === 'white' || v === 'black') BG = v;
  else if (v !== null) log(`[james-marit-render] ignoring --bg=${v} (expected "white" or "black")`);
}

const VALUE_FLAGS = new Set([
  '--max-dim', '--splat', '--tone', '--gamma', '--color-scheme', '--bg',
  '--line-opacity',
]);
const skipIdx = new Set<number>();
for (let i = 0; i < ARGS.length; i++) if (VALUE_FLAGS.has(ARGS[i])) skipIdx.add(i + 1);
const depthArg = ARGS.find((a, i) => !a.startsWith('--') && !skipIdx.has(i));

if (depthArg !== undefined) {
  const n = parseInt(depthArg, 10);
  if (Number.isFinite(n) && n >= 1) {
    DEPTH = n;
    log(`[james-marit-render] depth=${DEPTH} (from command line)`);
  } else {
    log(`[james-marit-render] ignoring non-integer depth arg "${depthArg}"`);
  }
}
if (DEPTH === VIEW_PRESET.previewDepth && depthArg === undefined && process.stdin.isTTY) {
  const { createInterface } = await import('node:readline/promises');
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question(`BFS depth [default ${DEPTH}]: `)).trim();
  rl.close();
  if (answer !== '') {
    const n = parseInt(answer, 10);
    if (Number.isFinite(n) && n >= 1) DEPTH = n;
    else log(`[james-marit-render] invalid depth "${answer}", using default ${DEPTH}`);
  }
}

log(`[james-marit-render] depth=${DEPTH}, max dim=${MAX_DIM}, splat=${SPLAT_RADIUS}, ` +
    `tone=${TONE_PERCENTILE}, gamma=${TONE_GAMMA}, bg=${BG}, color=${COLOR_SCHEME}, ` +
    `mode=${RENDER_MODE}` +
    (RENDER_MODE === 'points' ? '' : `, line-opacity=${LINE_OPACITY}`));

const tStart = Date.now();

// ─── Cache key ─────────────────────────────────────────────────────────────

const CACHE_DIR = fileURLToPath(new URL('./cache/', import.meta.url));

function hashJson(obj: unknown): string {
  return createHash('sha1').update(JSON.stringify(obj)).digest('hex').slice(0, 16);
}

const cacheKey = hashJson({
  depth:       DEPTH,
  maxDim:      MAX_DIM,
  colorScheme: COLOR_SCHEME,
  splatRadius: SPLAT_RADIUS,
  renderMode:  RENDER_MODE,
  lineOpacity: RENDER_MODE === 'points' ? null : LINE_OPACITY,
  generators:  VIEW_PRESET.generators,
  gamma:       VIEW_PRESET.gamma,
  preset: {
    projection: VIEW_PRESET.projection,
    camera:     VIEW_PRESET.camera,
    viewport:   VIEW_PRESET.viewport,
  },
});
const cachePath = `${CACHE_DIR}james-marit-depth${DEPTH}-${cacheKey}.acc`;

let imgW = 0, imgH = 0;
let projector!: Projector;

// ─── Accumulate phase ──────────────────────────────────────────────────────

interface AccumulateResult { acc: Accumulator; visited: number; drawn: number; }

/**
 * 2D Liang–Barsky clip of segment (x0,y0)→(x1,y1) against [0,W)×[0,H).
 * Returns the parameter range `[tMin, tMax] ⊂ [0,1]` of the visible chunk,
 * or `null` if the segment lies entirely outside the viewport.
 */
function clipSegment(
  x0: number, y0: number, x1: number, y1: number,
  W: number, H: number,
): { tMin: number; tMax: number } | null {
  const dx = x1 - x0, dy = y1 - y0;
  const p = [-dx, dx, -dy, dy];
  // Viewport is integer pixels [0..W-1]×[0..H-1]; deposit functions snap or
  // splat with a half-pixel tolerance, so we allow `W` and `H` as upper
  // limits (anything beyond is hopeless).
  const q = [x0, (W - 1) - x0, y0, (H - 1) - y0];
  let tMin = 0, tMax = 1;
  for (let k = 0; k < 4; k++) {
    if (p[k] === 0) {
      if (q[k] < 0) return null;
    } else {
      const t = q[k] / p[k];
      if (p[k] < 0) {
        if (t > tMin) tMin = t;
      } else {
        if (t < tMax) tMax = t;
      }
    }
  }
  return tMin > tMax ? null : { tMin, tMax };
}

/**
 * Rasterise a segment with DDA-stepping ≈ 1 pixel per step, depositing
 * `weight` into the accumulator at each integer pixel along the line.
 *
 * Bypasses the point-deposit closure (so `--splat` does NOT thicken
 * lines), keeping rays 1-pixel-thin. A `weight < 1` makes each line
 * pixel dimmer than a point hit — the "slightly transparent line" effect.
 * Tone-mapping at the end then composites lines and points consistently.
 */
function depositLineWeighted(
  data: Float32Array, W: number, H: number, K: number,
  x0: number, y0: number, x1: number, y1: number,
  channel: number, weight: number,
): boolean {
  const clip = clipSegment(x0, y0, x1, y1, W, H);
  if (clip === null) return false;
  const { tMin, tMax } = clip;
  const dx = x1 - x0, dy = y1 - y0;
  const visLen = Math.hypot(dx, dy) * (tMax - tMin);
  if (visLen < 1e-9) {
    const ix = Math.floor(x0 + tMin * dx + 0.5);
    const iy = Math.floor(y0 + tMin * dy + 0.5);
    if (ix < 0 || ix >= W || iy < 0 || iy >= H) return false;
    data[(iy * W + ix) * K + channel] += weight;
    return true;
  }
  const n = Math.max(1, Math.ceil(visLen));
  let any = false;
  for (let i = 0; i <= n; i++) {
    const t = tMin + (tMax - tMin) * (i / n);
    const ix = Math.floor(x0 + t * dx + 0.5);
    const iy = Math.floor(y0 + t * dy + 0.5);
    if (ix < 0 || ix >= W || iy < 0 || iy >= H) continue;
    data[(iy * W + ix) * K + channel] += weight;
    any = true;
  }
  return any;
}

function accumulate(action: GroupAction, basepoint: Float64Array): AccumulateResult {
  const projOut = makePresetProjector({
    embedding:  embeddingFromPreset(VIEW_PRESET.projection),
    cameraSpec: VIEW_PRESET.camera,
    aspect:     VIEW_PRESET.viewport.width / VIEW_PRESET.viewport.height,
    maxDim: MAX_DIM, minDim: MIN_DIM, dimRound: DIM_ROUND, log,
  });
  projector = projOut.project;
  imgW = projOut.imgW;
  imgH = projOut.imgH;

  const scheme = getScheme(COLOR_SCHEME);
  const K = scheme.categoryCount;
  const stepsBack = scheme.stepsBack;
  const acc = createAccumulator(imgW, imgH, K);

  const total = totalNodes(action.numGenerators, DEPTH);
  log(`Streaming DFS depth=${DEPTH} → ${imgW}×${imgH}×${K} accumulator ` +
      `(${formatCount(total)} total nodes, ${action.numGenerators} gens, ` +
      `scheme=${scheme.name}, mode=${RENDER_MODE})...`);

  let drawn = 0;
  const prog = createProgress({
    total, label: 'DFS', extra: () => `drawn ${formatCount(drawn)}`,
  });

  const W = imgW, H = imgH;
  const data = acc.data;

  const deposit: DepositFn = SPLAT_RADIUS === 0
    ? makeIntegerDeposit(data, W, H, K)
    : makeTentSplatDeposit(data, W, H, K, SPLAT_RADIUS);

  // Project [e₄] once. Used for the rays-to-e₄ mode. If null (chart
  // singularity at e₄, won't happen with Fabi but we check anyway),
  // silently fall back to points-only.
  let e4Pixel: { px: number; py: number } | null = null;
  if (RENDER_MODE !== 'points') {
    const e4buf = new Float64Array([0, 0, 0, 1]);
    e4Pixel = projector(e4buf, 0);
    if (e4Pixel === null) {
      log(`  WARNING: [e₄] is in the chart-singular hyperplane; falling back to 'points' mode`);
      RENDER_MODE = 'points';
    } else {
      log(`  [e₄] projects to pixel (${e4Pixel.px.toFixed(1)}, ${e4Pixel.py.toFixed(1)})`);
    }
  }

  const drawAt = (px: number, py: number, cat: number): void => {
    if (RENDER_MODE === 'points' || RENDER_MODE === 'both') {
      if (deposit(px, py, cat)) drawn++;
    }
    if ((RENDER_MODE === 'rays' || RENDER_MODE === 'both') && e4Pixel !== null) {
      if (depositLineWeighted(
            data, W, H, K, px, py, e4Pixel.px, e4Pixel.py, cat, LINE_OPACITY,
          )) drawn++;
    }
  };

  if (K === 1) {
    streamOrbit(action, basepoint, DEPTH, (vecs, off) => {
      prog.tick();
      const p = projector(vecs, off);
      if (p === null) return;
      drawAt(p.px, p.py, 0);
    });
  } else {
    streamOrbit(action, basepoint, DEPTH, (vecs, off, depth, lastGenStack) => {
      prog.tick();
      const p = projector(vecs, off);
      if (p === null) return;
      let cat: number;
      const d = depth - stepsBack;
      if (d < 1) {
        cat = 0;
      } else {
        const g = lastGenStack[d];
        cat = g > 3 ? 0 : g + 1;
      }
      drawAt(p.px, p.py, cat);
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
  const generators = VIEW_PRESET.generators.map(
    (m) => m.map((row: readonly number[]) => [...row]) as unknown as Mat4R,
  );
  const action = makeMat4Action(generators, { involutions: VIEW_PRESET.involutions });
  const bp = computeProximalBasepoint(action, VIEW_PRESET.gamma, VIEW_PRESET.powerIter);
  log(`Proximal basepoint: |λ_max(${VIEW_PRESET.gammaName})| ≈ ${bp.lambdaMax.toFixed(3)}, ` +
      `drift = ${bp.drift.toFixed(4)}`);
  const r = accumulate(action, bp.basepoint);
  acc = r.acc; visited = r.visited; drawn = r.drawn;
  if (drawn > 0) {
    log(`Caching accumulator to ${cachePath}...`);
    const tw = Date.now();
    try {
      writeAccumulatorFile(cachePath, acc, {
        depth: DEPTH,
        maxDim: MAX_DIM,
        colorScheme: COLOR_SCHEME,
        splatRadius: SPLAT_RADIUS,
        visited, drawn,
        generatedAt: new Date().toISOString(),
      });
      const bytes = 8 + 256 + imgW * imgH * acc.channels * 4;
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

log(`Tone-mapping (log + ${(TONE_PERCENTILE * 100).toFixed(1)}% percentile clip, ` +
    `gamma=${TONE_GAMMA}, ${BG} bg)...`);
const tt = Date.now();
const palette: Palette | undefined = acc.channels > 1 ? paletteForScheme(COLOR_SCHEME) : undefined;
const { rgba, scale } = accumulatorToRGBA(acc, {
  percentile: TONE_PERCENTILE,
  bg: BG, gamma: TONE_GAMMA,
  palette,
});
log(`  nonzero entries ${scale.nzCount.toLocaleString()}  clip = ${scale.clip.toFixed(3)}  in ${Date.now() - tt} ms`);

// ─── Metadata overlay + parameter-rich filename ───────────────────────────
//
// Always overlay the A and B 4×4 generators plus the s value in the upper-
// right of the image — same parameters that produced this rendering, so the
// file is self-documenting. Filename also gets the key parameters baked in
// so several runs at different s/α don't overwrite each other.

const params = VIEW_PRESET.params;

function fmtForFilename(v: number): string {
  // 3-decimal compact, minus sign preserved, no trailing zeros stripped.
  return v.toFixed(3).replace(/^-?/, (m) => m); // toFixed already keeps sign
}

const repTag = params
  ? (params.repMode === 'modular-torus'
      ? '-mt'
      : `-teich-x${fmtForFilename(params.x)}_y${fmtForFilename(params.y)}`)
  : '';
const sTag = params ? `-s${fmtForFilename(params.s)}` : '';
const aTag = params
  ? `-a${fmtForFilename(params.alphas[0])}_${fmtForFilename(params.alphas[1])}_${fmtForFilename(params.alphas[2])}`
  : '';
const splatTag = SPLAT_RADIUS > 0 ? `-splat${SPLAT_RADIUS}` : '';
const modeTag  = RENDER_MODE === 'points' ? '' : `-${RENDER_MODE}`;
const outputFile = outputPath('james-marit', `james-marit${repTag}${sTag}${aTag}-depth${DEPTH}-${imgW}x${imgH}${splatTag}${modeTag}.png`);

if (params) {
  log(`Drawing metadata overlay (A, B, s) in upper-right corner...`);
  drawMetadataOverlay(rgba, imgW, imgH, VIEW_PRESET.generators, params.s);
}

log(`Writing ${outputFile}...`);
const te = Date.now();
await writePng(outputFile, imgW, imgH, rgba);
log(`  wrote PNG in ${Date.now() - te} ms`);

log(`Done — total ${((Date.now() - tStart) / 1000).toFixed(1)}s`);

// ── Metadata overlay implementation ───────────────────────────────────────

function drawMetadataOverlay(
  rgba: Uint8Array, w: number, h: number,
  gens: readonly (readonly (readonly number[])[])[],
  sValue: number,
): void {
  const A = gens[0];
  const B = gens[1];
  // 6-significant-digit format keeps each entry ≤ 14 chars so the corner
  // block stays compact. Right-pad to the widest cell across BOTH A and B
  // so columns align under the (deliberately small) bitmap font.
  const fmtCell = (v: number): string => {
    if (v === 0) return '0';
    return v.toPrecision(6);
  };
  const allCells: string[] = [];
  for (const M of [A, B]) {
    for (const row of M) for (const v of row) allCells.push(fmtCell(v));
  }
  const cellW = Math.max(...allCells.map((s) => s.length));
  const cell = (v: number): string => fmtCell(v).padStart(cellW);
  const rowStr = (r: readonly number[]): string =>
    `[ ${r.map(cell).join(' ')} ]`;
  const text = [
    `A =`,
    ...A.map(rowStr),
    ``,
    `B =`,
    ...B.map(rowStr),
    ``,
    `s = ${fmtCell(sValue)}`,
  ].join('\n');

  const fontSize = pickFontSize(w);
  const style: TextStyle = {
    fontSize,
    color: [0, 0, 0],
    lineHeight: 1.2,
  };
  const { w: textW, h: textH } = measureText(text, style);
  const margin = Math.round(fontSize * 0.8);
  const padX   = Math.round(fontSize * 0.6);
  const padY   = Math.round(fontSize * 0.4);
  const x = w - textW - margin;
  const y = margin;
  fillRect(rgba, w, h,
    x - padX, y - padY,
    textW + padX * 2, textH + padY * 2,
    [255, 255, 255],
  );
  drawText(rgba, w, h, text, x, y, style);
}
