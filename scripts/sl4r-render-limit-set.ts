/**
 * sl4r-render-limit-set.ts
 *
 * Offline density-image render of a GL(4,R) limit set in RP³.
 *
 * Two phases — same shape as the sp6 / sl3r renderers:
 *   1. accumulate — stream the non-backtracking word tree by DFS (memory
 *      O(depth)); project each visited R⁴ state via the chart embedding
 *      (auto-chart by default, or a saved preset) + autofit orthographic
 *      camera; integer-deposit into a 2D accumulator. Cache to
 *      scripts/cache/<key>.acc.
 *   2. render — tone-map (log + percentile clip), write PNG.
 *
 *   node scripts/sl4r-render-limit-set.ts [depth] [flags...]
 *
 *   --example <id>          choose example from demos/sl4r-limit-sets/pair1.ts
 *   --max-dim N             long-side image dim (default 8192)
 *   --color-scheme <spec>   'grayscale' | 'last-gen' | 'kth-last:k'
 *   --bg white|black        default white
 *   --tone <p>              percentile clip in (0, 1]; default 0.999
 *   --gamma <g>             >0; reshape tone via t^(1/g)
 *   --splat N               integer ≥0; tent-splat radius
 *   --refresh               ignore the .acc cache
 *
 * If scripts/sl4r-view-preset.json exists (written by the browser demo's
 * "save view" button), the script uses that preset's chart + perspective
 * camera instead of the auto-chart + orthographic auto-fit. Output filename
 * gains a `-view` suffix.
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
import {
  type DepositFn,
  makeIntegerDeposit, makeTentSplatDeposit,
} from '../src/render/splat.ts';

import type { SL4RExample } from '../src/sl4r/types.ts';
import {
  exampleById,
  EXAMPLES,
} from '../demos/sl4r-limit-sets/pair1.ts';
import { makeMat4Action } from '../src/sl4r/action.ts';
import { embeddingFromPreset } from '../src/sl4r/embedding.ts';
import { paletteForScheme } from '../src/sl4r/palettes.ts';

import type { GroupAction } from '../src/core/group.ts';
import {
  computeProximalBasepoint,
  streamOrbit,
  totalNodes,
} from '../src/core/orbit.ts';
import { type Projector } from '../src/core/scene.ts';
import { fitAutoChartEmbedding } from '../src/core/chart.ts';
import { makeAutoProjector, makePresetProjector } from '../src/core/projector.ts';
import type { ViewPreset } from '../src/sl4r/viewPreset.ts';

// ─── EDITABLE defaults ─────────────────────────────────────────────────────

const DEFAULT_EXAMPLE_ID = 'pair1';

const DEFAULT_DEPTH    = 13;
const PILOT_DEPTH      = 12;

let   MAX_DIM          = 8192;
const MIN_DIM          = 128;
const DIM_ROUND        = 16;

const BBOX_TRIM        = 0.20;
const MAX_ASPECT       = 4;
const FIT_FILL         = 0.92;

let   TONE_PERCENTILE  = 0.999;
let   BG: Bg           = 'white';
let   TONE_GAMMA       = 1;

let   COLOR_SCHEME     = 'grayscale';
let   EXAMPLE_ID       = DEFAULT_EXAMPLE_ID;
let   DEPTH            = DEFAULT_DEPTH;
let   SPLAT_RADIUS     = 0;

// ─── View preset ───────────────────────────────────────────────────────────

let VIEW_PRESET: ViewPreset | null = null;
const VIEW_PRESET_PATH = fileURLToPath(new URL('./sl4r-view-preset.json', import.meta.url));
if (existsSync(VIEW_PRESET_PATH)) {
  try {
    VIEW_PRESET = JSON.parse(readFileSync(VIEW_PRESET_PATH, 'utf8'));
    process.stderr.write(`[sl4r-render] loaded sl4r-view-preset.json` +
      ` (exampleId=${VIEW_PRESET!.exampleId}, previewDepth=${VIEW_PRESET!.previewDepth})\n`);
    EXAMPLE_ID = VIEW_PRESET!.exampleId;
    if (typeof VIEW_PRESET!.colorScheme === 'string') {
      try {
        getScheme(VIEW_PRESET!.colorScheme);
        COLOR_SCHEME = VIEW_PRESET!.colorScheme;
      } catch (e) {
        process.stderr.write(`[sl4r-render] ignoring preset.colorScheme=${VIEW_PRESET!.colorScheme}: ${(e as Error).message}\n`);
      }
    }
  } catch (e) {
    process.stderr.write(`[sl4r-render] WARNING: ignoring malformed sl4r-view-preset.json: ${(e as Error).message}\n`);
    VIEW_PRESET = null;
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
  if (predicate(n)) set(n); else log(`[sl4r-render] ignoring ${name}=${v} (invalid)`);
}
function applyInt(
  name: string,
  set: (n: number) => void,
  predicate: (n: number) => boolean = (n) => Number.isFinite(n) && n > 0,
): void {
  const v = flagValue(name); if (v === null) return;
  const n = parseInt(v, 10);
  if (predicate(n)) set(n); else log(`[sl4r-render] ignoring ${name}=${v} (invalid)`);
}

applyInt(  '--max-dim', (n) => { MAX_DIM = n; }, (n) => Number.isFinite(n) && n >= 256);
applyInt(  '--splat',   (n) => { SPLAT_RADIUS = n; }, (n) => Number.isFinite(n) && n >= 0 && n <= 8);
applyFloat('--tone',    (n) => { TONE_PERCENTILE = n; }, (n) => Number.isFinite(n) && n > 0 && n <= 1);
applyFloat('--gamma',   (n) => { TONE_GAMMA = n; }, (n) => Number.isFinite(n) && n > 0);
{
  const v = flagValue('--color-scheme');
  if (v !== null) {
    try { getScheme(v); COLOR_SCHEME = v; }
    catch (e) { log(`[sl4r-render] ignoring --color-scheme=${v} (${(e as Error).message})`); }
  }
}
{
  const v = flagValue('--bg');
  if (v === 'white' || v === 'black') BG = v;
  else if (v !== null) log(`[sl4r-render] ignoring --bg=${v} (expected "white" or "black")`);
}
{
  const v = flagValue('--example');
  if (v !== null) {
    if (EXAMPLES.some((e) => e.id === v)) EXAMPLE_ID = v;
    else {
      log(`[sl4r-render] unknown example "${v}". available:`);
      for (const e of EXAMPLES) log(`     ${e.id.padEnd(20)} ${e.label}`);
      process.exit(1);
    }
  }
}

const VALUE_FLAGS = new Set([
  '--max-dim', '--splat', '--tone', '--gamma', '--color-scheme', '--bg', '--example',
]);
const skipIdx = new Set<number>();
for (let i = 0; i < ARGS.length; i++) if (VALUE_FLAGS.has(ARGS[i])) skipIdx.add(i + 1);
const depthArg = ARGS.find((a, i) => !a.startsWith('--') && !skipIdx.has(i));

if (depthArg !== undefined) {
  const n = parseInt(depthArg, 10);
  if (Number.isFinite(n) && n >= 1) {
    DEPTH = n;
    log(`[sl4r-render] depth=${DEPTH} (from command line)`);
  } else {
    log(`[sl4r-render] ignoring non-integer depth arg "${depthArg}"`);
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
    else log(`[sl4r-render] invalid depth "${answer}", using default ${DEFAULT_DEPTH}`);
  }
}

// ─── Active example ────────────────────────────────────────────────────────

const ACTIVE: SL4RExample = exampleById(EXAMPLE_ID);

log(`[sl4r-render] example=${ACTIVE.label} (${EXAMPLE_ID})` +
    (VIEW_PRESET ? ' — from VIEW_PRESET' : ' — auto-chart (no preset)'));
log(`[sl4r-render] depth=${DEPTH}, max dim=${MAX_DIM}, splat=${SPLAT_RADIUS}, ` +
    `tone=${TONE_PERCENTILE}, gamma=${TONE_GAMMA}, bg=${BG}, color=${COLOR_SCHEME}`);

const tStart = Date.now();

// ─── Cache key ─────────────────────────────────────────────────────────────

const CACHE_DIR = fileURLToPath(new URL('./cache/', import.meta.url));

function hashJson(obj: unknown): string {
  return createHash('sha1').update(JSON.stringify(obj)).digest('hex').slice(0, 16);
}

function buildCacheKey(): string {
  const keyObj: Record<string, unknown> = {
    exampleId:   EXAMPLE_ID,
    depth:       DEPTH,
    maxDim:      MAX_DIM,
    colorScheme: COLOR_SCHEME,
    splatRadius: SPLAT_RADIUS,
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
const cachePath = `${CACHE_DIR}sl4r-${EXAMPLE_ID}-depth${DEPTH}-${cacheKey}.acc`;

let imgW = 0, imgH = 0;
let projector!: Projector;
let outputSuffix = '';

// ─── Accumulate phase ──────────────────────────────────────────────────────

interface AccumulateResult { acc: Accumulator; visited: number; drawn: number; }

function accumulate(action: GroupAction, basepoint: Float64Array): AccumulateResult {
  const projOut = VIEW_PRESET
    ? makePresetProjector({
        embedding:  embeddingFromPreset(VIEW_PRESET.projection),
        cameraSpec: VIEW_PRESET.camera,
        aspect:     VIEW_PRESET.viewport.width / VIEW_PRESET.viewport.height,
        maxDim: MAX_DIM, minDim: MIN_DIM, dimRound: DIM_ROUND, log,
      })
    : makeAutoProjector({
        action, basepoint, depth: DEPTH, pilotDepth: PILOT_DEPTH,
        fitEmbedding: fitAutoChartEmbedding,
        maxDim: MAX_DIM, minDim: MIN_DIM, dimRound: DIM_ROUND,
        bboxTrim: BBOX_TRIM, maxAspect: MAX_ASPECT, fitFill: FIT_FILL, log,
      });
  projector = projOut.project;
  imgW = projOut.imgW;
  imgH = projOut.imgH;
  outputSuffix = VIEW_PRESET ? '-view' : '';

  const scheme = getScheme(COLOR_SCHEME);
  const K = scheme.categoryCount;
  const stepsBack = scheme.stepsBack;
  const acc = createAccumulator(imgW, imgH, K);

  const total = totalNodes(action.numGenerators, DEPTH);
  log(`Streaming DFS depth=${DEPTH} → ${imgW}×${imgH}×${K} accumulator ` +
      `(${formatCount(total)} total nodes, ${action.numGenerators} gens, scheme=${scheme.name})...`);

  let drawn = 0;
  const prog = createProgress({
    total, label: 'DFS', extra: () => `drawn ${formatCount(drawn)}`,
  });

  const W = imgW, H = imgH;
  const data = acc.data;

  const deposit: DepositFn = SPLAT_RADIUS === 0
    ? makeIntegerDeposit(data, W, H, K)
    : makeTentSplatDeposit(data, W, H, K, SPLAT_RADIUS);

  if (K === 1) {
    streamOrbit(action, basepoint, DEPTH, (vecs, off) => {
      prog.tick();
      const p = projector(vecs, off);
      if (p === null) return;
      if (deposit(p.px, p.py, 0)) drawn++;
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
      if (deposit(p.px, p.py, cat)) drawn++;
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
  const action = makeMat4Action(ACTIVE.generators, { involutions: ACTIVE.involutions });
  const bp = computeProximalBasepoint(action, ACTIVE.gamma, ACTIVE.powerIter);
  log(`Proximal basepoint: |λ_max(${ACTIVE.gammaName})| ≈ ${bp.lambdaMax.toFixed(3)}, ` +
      `drift = ${bp.drift.toFixed(4)}`);
  const r = accumulate(action, bp.basepoint);
  acc = r.acc; visited = r.visited; drawn = r.drawn;
  if (drawn > 0) {
    log(`Caching accumulator to ${cachePath}...`);
    const tw = Date.now();
    try {
      writeAccumulatorFile(cachePath, acc, {
        exampleId:   EXAMPLE_ID,
        depth:       DEPTH,
        maxDim:      MAX_DIM,
        colorScheme: COLOR_SCHEME,
        splatRadius: SPLAT_RADIUS,
        mode:        VIEW_PRESET ? 'preset' : 'auto',
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

const splatTag = SPLAT_RADIUS > 0 ? `-splat${SPLAT_RADIUS}` : '';
const outputFile =
  `sl4r-${EXAMPLE_ID}-depth${DEPTH}-${imgW}x${imgH}${splatTag}${outputSuffix}.png`;
log(`Writing ${outputFile}...`);
const te = Date.now();
await writePng(outputFile, imgW, imgH, rgba);
log(`  wrote PNG in ${Date.now() - te} ms`);

log(`Done — total ${((Date.now() - tStart) / 1000).toFixed(1)}s`);
