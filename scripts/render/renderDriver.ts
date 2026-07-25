/**
 * Generic offline limit-set render driver.
 *
 * Owns everything the per-family render scripts had in common — argv flags,
 * view-preset loading, the accumulator cache, the streamed DFS deposit loop,
 * tone-mapping, and the PNG write to outputs/<family>/. A family supplies only
 * its mathematics through a `RenderPlugin`: how to look up an example, build the
 * action, find a seed, fit/reconstruct the projective chart, and pick a palette.
 *
 *   node scripts/<family>-render-limit-set.ts [exampleId] [depth] [flags...]
 *   flags: --max-dim N  --gamma G  --tone P  --bg white|black
 *          --color-scheme grayscale|last-gen|kth-last:k  --splat R
 *          --depth N  --no-preset  --refresh
 *
 * A family may also paint geometry over the finished image (`overlay`) — that
 * runs after tone-mapping and after the accumulator cache, so restyling an
 * overlay is instant.
 *
 * View-preset mode (default when outputs/presets/<family>-view-preset.json exists)
 * reproduces a framed perspective view exported from the demo; AUTO mode does a
 * PCA-pilot + percentile-bbox orthographic autofit. The preset's exampleId wins.
 */

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

import {
  createAccumulator, writeAccumulatorFile, readAccumulatorFile, type Accumulator,
} from '../../src/render/accumulator.ts';
import { accumulatorToRGBA, type Bg, type Palette } from '../../src/render/tone.ts';
import { writePng } from '../../src/render/png.ts';
import { createProgress, formatCount } from '../../src/render/progress.ts';
import { getScheme, categoryFromStack } from '../../src/render/colorScheme.ts';
import { type DepositFn, makeIntegerDeposit, makeTentSplatDeposit } from '../../src/render/splat.ts';
import { outputPath } from '../../src/render/outputPath.ts';

import type { GroupAction } from '../../src/core/group.ts';
import { streamOrbit, totalNodes, type Orbit } from '../../src/core/orbit.ts';
import type { Projector, SceneEmbedding } from '../../src/core/scene.ts';
import type { Camera } from '../../src/core/camera.ts';
import { makeAutoProjector, makePresetProjector } from '../../src/core/projector.ts';

/** What a family must provide; `E` is the family's example type. */
export interface RenderPlugin<E> {
  family: string;            // outputs/<family>/, outputs/presets/<family>-view-preset.json, log tag
  defaultExampleId: string;
  defaultDepth: number;

  resolveExample(id: string): E | undefined;
  exampleId(e: E): string;
  /** One-line identity for the banner (defaults to the id). */
  banner?(e: E): string;
  /** A per-render variant tag mixed into the cache key + filename (e.g. the
   *  sphere/plane embedding name for sl2c/sl3r). `preset` is the loaded view
   *  preset, or null in auto mode. */
  variant?(e: E, preset: ViewPresetLike | null): string;

  makeAction(e: E): GroupAction;
  /** Seed point on the limit set + a one-line note for the banner. */
  findSeed(action: GroupAction, e: E): { basepoint: Float64Array; note: string };

  paletteForScheme(schemeName: string): Palette;

  /** Scene embedding for AUTO mode, given a pilot orbit (PCA fit, or a family's
   *  fixed embedding ignoring the pilot). */
  fitEmbedding(pilot: Orbit, e: E): SceneEmbedding;
  /** Scene embedding reconstructed from a saved preset, for PRESET mode. Omit if
   *  the family has no preset mode. */
  presetEmbedding?(preset: ViewPresetLike, e: E): SceneEmbedding;
  /** Family-specific CLI flags that take a value (e.g. '--phase'), so the
   *  driver does not mistake their values for the positional exampleId. */
  extraValueFlags?: readonly string[];

  /**
   * Extra ℝ³ scene points to keep inside the AUTO-mode frame (packed xyz).
   * Λ alone sets the framing otherwise, which would crop any companion geometry.
   */
  autofitExtras?(embedding: SceneEmbedding, e: E): Float64Array;

  /**
   * Draw over the tone-mapped image, before it is written. This is where a
   * family paints geometry that is not part of the density accumulation — a
   * convex domain, a fundamental polygon, an axis frame. The embedding and
   * camera handed over are exactly the ones Λ was rasterized through, so the
   * overlay lands in the same view; and it runs after the cache, so restyling
   * an overlay never re-runs the DFS.
   */
  overlay?(ctx: OverlayContext, e: E): void;
}

/** What a plugin's `overlay` is handed: the finished pixels + the live view. */
export interface OverlayContext {
  rgba: Uint8Array;
  imgW: number;
  imgH: number;
  embedding: SceneEmbedding;
  camera: Camera;
  /** The loaded view preset, or null in auto mode. */
  preset: unknown;
  log(msg: string): void;
}

/** The preset fields the driver reads (families add their own projection/embedding). */
interface ViewPresetLike {
  exampleId: string;
  previewDepth: number;
  colorScheme?: string;
  camera: { position: readonly [number, number, number]; target: readonly [number, number, number]; up: readonly [number, number, number]; fov: number; aspect: number; near: number; far: number };
  viewport: { width: number; height: number };
}

const MIN_DIM = 128, DIM_ROUND = 16;

export async function runRender<E>(plugin: RenderPlugin<E>): Promise<void> {
  const tag = plugin.family;
  const log = (m: string): void => { process.stderr.write(m + '\n'); };

  // ─── argv ──────────────────────────────────────────────────────────────────
  const ARGS = process.argv.slice(2);
  const flag = (name: string): string | null => {
    const i = ARGS.indexOf(name);
    return i >= 0 && i + 1 < ARGS.length ? ARGS[i + 1] : null;
  };
  const VALUE_FLAGS = new Set([
    '--max-dim', '--gamma', '--tone', '--bg', '--color-scheme', '--splat', '--depth',
    ...(plugin.extraValueFlags ?? []),
  ]);
  const positional = ARGS.filter((a, i) => !a.startsWith('--') && !VALUE_FLAGS.has(ARGS[i - 1] ?? ''));

  const MAX_DIM = flag('--max-dim') ? Math.max(256, parseInt(flag('--max-dim')!, 10)) : 6000;
  const TONE_GAMMA = flag('--gamma') ? parseFloat(flag('--gamma')!) : 1;
  const TONE_PERCENTILE = flag('--tone') ? parseFloat(flag('--tone')!) : 0.999;
  const BG: Bg = flag('--bg') === 'black' ? 'black' : 'white';
  const SPLAT_RADIUS = flag('--splat') ? Math.max(0, Math.min(8, parseInt(flag('--splat')!, 10))) : 0;
  const FORCE_REFRESH = ARGS.includes('--refresh') || ARGS.includes('--no-cache');
  let COLOR_SCHEME = 'grayscale';
  { const v = flag('--color-scheme'); if (v !== null) { try { getScheme(v); COLOR_SCHEME = v; } catch (e) { log(`[${tag}-render] ignoring --color-scheme=${v} (${(e as Error).message})`); } } }

  // ─── view preset ────────────────────────────────────────────────────────────
  const PRESET_PATH = fileURLToPath(new URL(`../../outputs/presets/${tag}-view-preset.json`, import.meta.url));
  let preset: ViewPresetLike | null = null;
  if (plugin.presetEmbedding && !ARGS.includes('--no-preset') && existsSync(PRESET_PATH)) {
    try {
      preset = JSON.parse(readFileSync(PRESET_PATH, 'utf8')) as ViewPresetLike;
      log(`[${tag}-render] loaded ${tag}-view-preset.json (exampleId=${preset.exampleId}, previewDepth=${preset.previewDepth})`);
      if (preset.colorScheme && !flag('--color-scheme')) { try { getScheme(preset.colorScheme); COLOR_SCHEME = preset.colorScheme; } catch { /* keep default */ } }
    } catch (e) { log(`[${tag}-render] ignoring malformed preset: ${(e as Error).message}`); preset = null; }
  }

  // ─── example + depth ─────────────────────────────────────────────────────────
  const EXAMPLE_ID = preset ? preset.exampleId : (positional[0] ?? plugin.defaultExampleId);
  const DEPTH = flag('--depth') ? parseInt(flag('--depth')!, 10)
    : preset ? preset.previewDepth
    : positional[1] ? parseInt(positional[1], 10)
    : plugin.defaultDepth;

  const ex = plugin.resolveExample(EXAMPLE_ID);
  if (!ex) { log(`[${tag}-render] unknown example id '${EXAMPLE_ID}'`); process.exit(1); }

  log(`[${tag}-render] ${plugin.banner?.(ex) ?? plugin.exampleId(ex)}  mode=${preset ? 'preset' : 'auto'}  depth=${DEPTH}  max-dim=${MAX_DIM}  gamma=${TONE_GAMMA}  bg=${BG}  color=${COLOR_SCHEME}  splat=${SPLAT_RADIUS}`);

  const action = plugin.makeAction(ex);
  const seed = plugin.findSeed(action, ex);
  log(`[${tag}-render] seed: ${seed.note}`);
  const variant = plugin.variant?.(ex, preset);

  // ─── projector ────────────────────────────────────────────────────────────────
  const dimOpts = { minDim: MIN_DIM, dimRound: DIM_ROUND };
  let project: Projector, imgW: number, imgH: number, outputSuffix = '';
  let embedding: SceneEmbedding, camera: Camera;
  if (preset && plugin.presetEmbedding) {
    const o = makePresetProjector({
      embedding: plugin.presetEmbedding(preset, ex), cameraSpec: preset.camera,
      aspect: preset.viewport.width / preset.viewport.height, maxDim: MAX_DIM, ...dimOpts, log,
    });
    project = o.project; imgW = o.imgW; imgH = o.imgH; outputSuffix = '-view';
    embedding = o.embedding; camera = o.camera;
  } else {
    const o = makeAutoProjector({
      action, basepoint: seed.basepoint, depth: DEPTH, pilotDepth: Math.min(DEPTH, 12),
      fitEmbedding: (pilot) => plugin.fitEmbedding(pilot, ex),
      extraFitPoints: plugin.autofitExtras ? (emb) => plugin.autofitExtras!(emb, ex) : undefined,
      maxDim: MAX_DIM, ...dimOpts, bboxTrim: 0.20, maxAspect: 4, fitFill: 0.92, log,
    });
    project = o.project; imgW = o.imgW; imgH = o.imgH;
    embedding = o.embedding; camera = o.camera;
  }

  // ─── accumulate (cache, or stream the DFS) ───────────────────────────────────
  const scheme = getScheme(COLOR_SCHEME);
  const cacheKey = createHash('sha1').update(JSON.stringify({
    family: tag, exampleId: EXAMPLE_ID, depth: DEPTH, maxDim: MAX_DIM, colorScheme: COLOR_SCHEME,
    splatRadius: SPLAT_RADIUS, variant: variant ?? null, mode: preset ? 'preset' : 'auto',
    preset: preset ? { camera: preset.camera, viewport: preset.viewport } : null,
  })).digest('hex').slice(0, 16);
  const cachePath = `${fileURLToPath(new URL('../../outputs/cache/', import.meta.url))}${EXAMPLE_ID}-depth${DEPTH}-${cacheKey}.acc`;

  let acc: Accumulator | undefined, drawn = 0, loadedFromCache = false;
  if (!FORCE_REFRESH && existsSync(cachePath)) {
    try {
      const r = readAccumulatorFile(cachePath);
      acc = r.acc; imgW = acc.width; imgH = acc.height;
      outputSuffix = r.userMeta.mode === 'preset' ? '-view' : '';
      drawn = (r.userMeta.drawn as number | undefined) ?? 0;
      loadedFromCache = true;
      log(`Loaded accumulator cache ${imgW}×${imgH}×${acc.channels} (drawn ${drawn.toLocaleString()})`);
    } catch (e) { log(`  cache load failed (${(e as Error).message}); recomputing.`); }
  }

  if (!loadedFromCache) {
    const K = scheme.categoryCount, stepsBack = scheme.stepsBack;
    acc = createAccumulator(imgW, imgH, K);
    const deposit: DepositFn = SPLAT_RADIUS === 0
      ? makeIntegerDeposit(acc.data, imgW, imgH, K)
      : makeTentSplatDeposit(acc.data, imgW, imgH, K, SPLAT_RADIUS);
    const total = totalNodes(action.numGenerators, DEPTH);
    const prog = createProgress({ total, label: 'DFS', extra: () => `drawn ${formatCount(drawn)}` });
    log(`Streaming DFS depth=${DEPTH} → ${imgW}×${imgH}×${K} (scheme=${scheme.name})...`);

    if (K === 1) {
      streamOrbit(action, seed.basepoint, DEPTH, (vecs, off) => {
        prog.tick(); const p = project(vecs, off); if (p && deposit(p.px, p.py, 0)) drawn++;
      });
    } else {
      streamOrbit(action, seed.basepoint, DEPTH, (vecs, off, depth, lastGenStack) => {
        prog.tick(); const p = project(vecs, off);
        if (p && deposit(p.px, p.py, categoryFromStack(stepsBack, depth, lastGenStack))) drawn++;
      });
    }
    prog.done();
    log(`  DFS done: drawn ${drawn.toLocaleString()} in ${prog.elapsed.toFixed(1)}s`);

    if (drawn > 0) {
      try {
        writeAccumulatorFile(cachePath, acc, {
          exampleId: EXAMPLE_ID, depth: DEPTH, maxDim: MAX_DIM, colorScheme: COLOR_SCHEME,
          splatRadius: SPLAT_RADIUS, mode: preset ? 'preset' : 'auto', drawn,
        });
      } catch (e) { log(`  cache write failed: ${(e as Error).message}`); }
    }
  }

  if (!acc || (drawn === 0 && !loadedFromCache)) { log('Nothing to render. Exiting.'); process.exit(1); }

  // ─── tone-map + write ────────────────────────────────────────────────────────
  const palette: Palette | undefined = acc.channels > 1 ? plugin.paletteForScheme(COLOR_SCHEME) : undefined;
  const { rgba, scale } = accumulatorToRGBA(acc, { percentile: TONE_PERCENTILE, bg: BG, gamma: TONE_GAMMA, palette });
  log(`  nonzero ${scale.nzCount.toLocaleString()}  clip ${scale.clip.toFixed(3)}`);

  if (plugin.overlay) {
    const t0 = Date.now();
    plugin.overlay({ rgba, imgW, imgH, embedding, camera, preset, log }, ex);
    log(`  overlay drawn in ${Date.now() - t0} ms`);
  }

  const splatTag = SPLAT_RADIUS > 0 ? `-splat${SPLAT_RADIUS}` : '';
  const variantTag = variant ? `-${variant}` : '';
  const outputFile = outputPath(tag, `${EXAMPLE_ID}${variantTag}-depth${DEPTH}-${imgW}x${imgH}${splatTag}${outputSuffix}.png`);
  await writePng(outputFile, imgW, imgH, rgba);
  log(`[${tag}-render] wrote ${outputFile}`);
}
