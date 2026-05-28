/**
 * schwartz-pappus-render-limit-set.ts
 *
 * Offline density-image render of a Schwartz–Pappus limit set on RP².
 *
 * Self-contained: reads `scripts/schwartz-pappus-view-preset.json` (written
 * by the demo's "copy view JSON for offline render" button), which carries
 * the live 3×3 generators (g₁, g₂), γ word, embedding name, and camera —
 * the renderer doesn't need to re-import the Pappus math.
 *
 *   node scripts/schwartz-pappus-render-limit-set.ts [depth] [flags...]
 *
 *   --max-dim N             long-side image dim (default 8192)
 *   --color-scheme <spec>   'grayscale' | 'last-gen' | 'kth-last:k'
 *   --bg white|black        default white
 *   --tone <p>              percentile clip in (0, 1]; default 0.999
 *   --gamma <g>             >0; reshape tone via t^(1/g)
 *   --splat N               integer ≥0; tent-splat radius
 *   --refresh               ignore the .acc cache
 *
 * Workflow: in the browser demo, tune (c, d, b) + camera, press
 * "copy view JSON for offline render", then run this script.
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

import { makeMat3Action, type Mat3R } from '../src/sl3r/action.ts';
import { sphereEmbedding, planeEmbedding } from '../src/sl3r/embedding.ts';
import { paletteForScheme } from '../src/sl3r/palettes.ts';

import type { GroupAction } from '../src/core/group.ts';
import {
  computeProximalBasepoint,
  streamOrbit,
  totalNodes,
} from '../src/core/orbit.ts';
import type { SceneEmbedding } from '../src/core/scene.ts';
import { type Projector } from '../src/core/scene.ts';
import { makePresetProjector } from '../src/core/projector.ts';
import type { SchwartzPappusViewPreset } from '../demos/schwartz-pappus/viewPreset.ts';
// Flag-variety viz is being reworked — see demos/schwartz-pappus/flagEmbedding.ts
// for the skeleton. Once one of the approaches lands, add the matching
// embedding-mode branch in the action/basepoint construction below.

// ─── Defaults ──────────────────────────────────────────────────────────────

const DEFAULT_DEPTH = 14;

let MAX_DIM    = 8192;
const MIN_DIM  = 128;
const DIM_ROUND = 16;

let TONE_PERCENTILE = 0.999;
let BG: Bg          = 'white';
let TONE_GAMMA      = 1;

let COLOR_SCHEME = 'grayscale';
let DEPTH        = DEFAULT_DEPTH;
let SPLAT_RADIUS = 0;

// ─── Load view preset (required) ───────────────────────────────────────────

const log = (msg: string): void => { process.stderr.write(msg + '\n'); };

const VIEW_PRESET_PATH = fileURLToPath(
  new URL('./schwartz-pappus-view-preset.json', import.meta.url),
);
if (!existsSync(VIEW_PRESET_PATH)) {
  log(`[schwartz-pappus-render] missing ${VIEW_PRESET_PATH}`);
  log(`    Open the schwartz-pappus demo in the browser, tune the view, then press`);
  log(`    "copy view JSON for offline render" — that writes this file.`);
  process.exit(1);
}

let VIEW_PRESET: SchwartzPappusViewPreset;
try {
  VIEW_PRESET = JSON.parse(readFileSync(VIEW_PRESET_PATH, 'utf8')) as SchwartzPappusViewPreset;
} catch (e) {
  log(`[schwartz-pappus-render] failed to parse view preset: ${(e as Error).message}`);
  process.exit(1);
}

if (
  !Array.isArray(VIEW_PRESET.generators) ||
  VIEW_PRESET.generators.length === 0
) {
  log(`[schwartz-pappus-render] view preset has no generators — was it written by an old demo?`);
  process.exit(1);
}

if (typeof VIEW_PRESET.colorScheme === 'string') {
  try {
    getScheme(VIEW_PRESET.colorScheme);
    COLOR_SCHEME = VIEW_PRESET.colorScheme;
  } catch (e) {
    log(`[schwartz-pappus-render] ignoring preset.colorScheme=${VIEW_PRESET.colorScheme}: ${(e as Error).message}`);
  }
}
DEPTH = VIEW_PRESET.previewDepth ?? DEFAULT_DEPTH;

const EMBEDDING_NAME = VIEW_PRESET.embedding;
const EMBEDDING: SceneEmbedding =
  EMBEDDING_NAME === 'sphere' ? sphereEmbedding : planeEmbedding;

const { c: pC, d: pD, b: pB, a: pA } = VIEW_PRESET.params;
log(`[schwartz-pappus-render] loaded schwartz-pappus-view-preset.json` +
    ` (c=${pC.toFixed(3)}, d=${pD.toFixed(3)}, b=${pB.toFixed(3)}, a=${pA.toFixed(4)},` +
    ` embedding=${EMBEDDING_NAME}, γ=${VIEW_PRESET.gammaName}, previewDepth=${VIEW_PRESET.previewDepth})`);

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
  if (predicate(n)) set(n); else log(`[schwartz-pappus-render] ignoring ${name}=${v} (invalid)`);
}
function applyInt(
  name: string,
  set: (n: number) => void,
  predicate: (n: number) => boolean = (n) => Number.isFinite(n) && n > 0,
): void {
  const v = flagValue(name); if (v === null) return;
  const n = parseInt(v, 10);
  if (predicate(n)) set(n); else log(`[schwartz-pappus-render] ignoring ${name}=${v} (invalid)`);
}

applyInt(  '--max-dim', (n) => { MAX_DIM = n; }, (n) => Number.isFinite(n) && n >= 256);
applyInt(  '--splat',   (n) => { SPLAT_RADIUS = n; }, (n) => Number.isFinite(n) && n >= 0 && n <= 8);
applyFloat('--tone',    (n) => { TONE_PERCENTILE = n; }, (n) => Number.isFinite(n) && n > 0 && n <= 1);
applyFloat('--gamma',   (n) => { TONE_GAMMA = n; }, (n) => Number.isFinite(n) && n > 0);
{
  const v = flagValue('--color-scheme');
  if (v !== null) {
    try { getScheme(v); COLOR_SCHEME = v; }
    catch (e) { log(`[schwartz-pappus-render] ignoring --color-scheme=${v} (${(e as Error).message})`); }
  }
}
{
  const v = flagValue('--bg');
  if (v === 'white' || v === 'black') BG = v;
  else if (v !== null) log(`[schwartz-pappus-render] ignoring --bg=${v} (expected "white" or "black")`);
}

const VALUE_FLAGS = new Set([
  '--max-dim', '--splat', '--tone', '--gamma', '--color-scheme', '--bg',
]);
const skipIdx = new Set<number>();
for (let i = 0; i < ARGS.length; i++) if (VALUE_FLAGS.has(ARGS[i])) skipIdx.add(i + 1);
const depthArg = ARGS.find((a, i) => !a.startsWith('--') && !skipIdx.has(i));

if (depthArg !== undefined) {
  const n = parseInt(depthArg, 10);
  if (Number.isFinite(n) && n >= 1) {
    DEPTH = n;
    log(`[schwartz-pappus-render] depth=${DEPTH} (from command line)`);
  } else {
    log(`[schwartz-pappus-render] ignoring non-integer depth arg "${depthArg}"`);
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
    else log(`[schwartz-pappus-render] invalid depth "${answer}", using default ${DEPTH}`);
  }
}

log(`[schwartz-pappus-render] depth=${DEPTH}, max dim=${MAX_DIM}, splat=${SPLAT_RADIUS}, ` +
    `tone=${TONE_PERCENTILE}, gamma=${TONE_GAMMA}, bg=${BG}, color=${COLOR_SCHEME}`);

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
  embedding:   EMBEDDING_NAME,
  splatRadius: SPLAT_RADIUS,
  generators:  VIEW_PRESET.generators,
  gamma:       VIEW_PRESET.gamma,
  preset: {
    camera:   VIEW_PRESET.camera,
    viewport: VIEW_PRESET.viewport,
  },
});
const cachePath = `${CACHE_DIR}schwartz-pappus-${EMBEDDING_NAME}-depth${DEPTH}-${cacheKey}.acc`;

let imgW = 0, imgH = 0;
let projector!: Projector;

// ─── Accumulate phase ──────────────────────────────────────────────────────

interface AccumulateResult { acc: Accumulator; visited: number; drawn: number; }

function accumulate(action: GroupAction, basepoint: Float64Array): AccumulateResult {
  const projOut = makePresetProjector({
    embedding:  EMBEDDING,
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
    (m) => m.map((row: readonly number[]) => [...row]) as unknown as Mat3R,
  );
  const action = makeMat3Action(generators, { involutions: VIEW_PRESET.involutions });
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
        embedding: EMBEDDING_NAME,
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

const splatTag = SPLAT_RADIUS > 0 ? `-splat${SPLAT_RADIUS}` : '';
const paramTag =
  `c${pC.toFixed(3)}-d${pD.toFixed(3)}-b${pB.toFixed(3)}`;
const outputFile =
  `schwartz-pappus-${paramTag}-${EMBEDDING_NAME}-depth${DEPTH}-${imgW}x${imgH}${splatTag}.png`;
log(`Writing ${outputFile}...`);
const te = Date.now();
await writePng(outputFile, imgW, imgH, rgba);
log(`  wrote PNG in ${Date.now() - te} ms`);

log(`Done — total ${((Date.now() - tStart) / 1000).toFixed(1)}s`);
