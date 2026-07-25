/**
 * Generic offline-render projector orchestrators.
 *
 *   makePresetProjector — perspective view from a serialised camera spec +
 *                         caller-built SceneEmbedding. Use to reproduce a
 *                         saved view at higher BFS depth / resolution.
 *
 *   makeAutoProjector   — orthographic view automatically fit from a pilot
 *                         BFS. Caller supplies `fitEmbedding` (e.g. an
 *                         auto-PCA chart fitter); the orchestrator runs the
 *                         pilot, calls the fitter, percentile-bboxes the
 *                         result, and composes into a Projector.
 *
 * Both return `{ project, imgW, imgH }` — the per-state pixel projector
 * plus the resolved image dimensions.
 *
 * Nothing here is group-specific. Every concrete projector pipeline (sp6
 * today, any RP^n group tomorrow) reuses the same orchestration; the only
 * thing each group brings is its embedding fitter and its preset format.
 */

import type { GroupAction } from './group.ts';
import { generateOrbit, type Orbit } from './orbit.ts';
import { composeProjector, type Projector, type SceneEmbedding } from './scene.ts';
import {
  type Camera,
  type DimOptions,
  type PerspectiveSpec,
  fitViewBbox,
  makeOrthographicCamera,
  makePerspectiveCamera,
  resolveImageDims,
} from './camera.ts';

export interface ProjectorOutput {
  project: Projector;
  imgW: number;
  imgH: number;
  /** The two halves `project` was composed from, for callers that need to place
   *  extra GEOMETRY in the same view (e.g. a convex domain drawn over Λ). */
  embedding: SceneEmbedding;
  camera: Camera;
}

// ─── Preset projector (perspective) ─────────────────────────────────────────

export interface PresetProjectorOptions extends DimOptions {
  /** SceneEmbedding reconstructed from the caller's preset format. */
  embedding: SceneEmbedding;
  /** Perspective camera spec (position, target, up, fov, near, far). */
  cameraSpec: PerspectiveSpec;
  /** Aspect ratio (W/H) of the source viewport; resolves output image dims. */
  aspect: number;
  /** Long side of the output image, in pixels. */
  maxDim: number;
  log?: (msg: string) => void;
}

export function makePresetProjector(opts: PresetProjectorOptions): ProjectorOutput {
  const { imgW, imgH } = resolveImageDims(opts.aspect, opts.maxDim, opts);
  opts.log?.(`Using exported camera (fov=${opts.cameraSpec.fov}°, aspect=${opts.aspect.toFixed(3)})  →  image = ${imgW}×${imgH}`);

  const camera = makePerspectiveCamera({
    position: opts.cameraSpec.position,
    target:   opts.cameraSpec.target,
    up:       opts.cameraSpec.up,
    fov:      opts.cameraSpec.fov,
    near:     opts.cameraSpec.near,
    far:      opts.cameraSpec.far,
    imgW, imgH,
  });

  return { project: composeProjector(opts.embedding, camera), imgW, imgH, embedding: opts.embedding, camera };
}

// ─── Auto projector (pilot BFS + caller's fitter + percentile bbox) ────────

export interface AutoProjectorOptions extends DimOptions {
  action: GroupAction;
  basepoint: Float64Array;
  /** Full BFS depth the caller will use; pilot is capped at this. */
  depth: number;
  /** Cap for pilot BFS depth. Default 12. */
  pilotDepth?: number;
  /** Long side of the output image, in pixels. */
  maxDim: number;
  /**
   * Build a SceneEmbedding from the pilot orbit. This is the only
   * group-specific knob; for projective limit sets, pass
   * `fitAutoChartEmbedding` from @/core/chart.
   */
  fitEmbedding: (pilot: Orbit) => SceneEmbedding;
  /** Percentile trim per side for the bbox. Default 0.20. */
  bboxTrim?: number;
  /** Cap image w/h (or h/w) at this. Default 4. */
  maxAspect?: number;
  /** Fraction of the image the view rect should fill. Default 0.92. */
  fitFill?: number;
  /**
   * Extra ℝ³ scene points (packed xyz) to include in the autofit bbox, given the
   * fitted embedding. Use when the picture contains geometry beyond the orbit —
   * a convex domain, an axis frame — that would otherwise be cropped.
   */
  extraFitPoints?: (embedding: SceneEmbedding) => Float64Array;
  log?: (msg: string) => void;
}

export function makeAutoProjector(opts: AutoProjectorOptions): ProjectorOutput {
  const pilotDepth = Math.min(opts.depth, opts.pilotDepth ?? 12);
  const log = opts.log;

  log?.(`Pilot BFS (depth ${pilotDepth}) for embedding fit + bbox...`);
  const tp = Date.now();
  const pilot = generateOrbit(opts.action, opts.basepoint, pilotDepth);
  log?.(`  pilot BFS in ${Date.now() - tp} ms, ${pilot.count.toLocaleString()} nodes`);

  log?.('Fitting scene embedding on pilot orbit...');
  const tc = Date.now();
  const embedding = opts.fitEmbedding(pilot);
  log?.(`  fit done in ${Date.now() - tc} ms (${embedding.pretty})`);

  log?.('Computing autofit bbox from pilot orbit...');
  const tb = Date.now();
  // Apply the embedding to the pilot orbit; drop skipped points.
  const scenePoints = new Float64Array(pilot.count * 3);
  let kept = 0;
  for (let i = 0; i < pilot.count; i++) {
    if (embedding.embed(pilot.vecs, i * pilot.stateDim, scenePoints, kept * 3)) kept++;
  }
  const bbox = fitViewBbox(scenePoints, kept, opts);

  // The percentile bbox is a statistic of the orbit, so extra geometry cannot be
  // folded into it as more samples (a few hundred points never move a 20%
  // percentile). Instead, GROW the fitted rect until it contains them.
  let { xLo, xHi, yLo, yHi } = bbox;
  const extra = opts.extraFitPoints?.(embedding);
  if (extra && extra.length >= 3) {
    for (let i = 0; i + 2 < extra.length; i += 3) {
      const x = extra[i], y = extra[i + 1];
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      xLo = Math.min(xLo, x); xHi = Math.max(xHi, x);
      yLo = Math.min(yLo, y); yHi = Math.max(yHi, y);
    }
    // Breathing room: geometry that exactly touches the frame reads as cropped,
    // and its outline stroke would be half outside the image.
    const padX = (xHi - xLo) * 0.03, padY = (yHi - yLo) * 0.03;
    xLo -= padX; xHi += padX; yLo -= padY; yHi += padY;
    log?.(`  grown for extra geometry: [${xLo.toFixed(3)}, ${xHi.toFixed(3)}] × [${yLo.toFixed(3)}, ${yHi.toFixed(3)}]`);
  }

  const aspect = (xHi - xLo) / (yHi - yLo);
  const { imgW, imgH } = resolveImageDims(aspect, opts.maxDim, opts);
  log?.(`  bbox = [${bbox.rawXLo.toFixed(3)}, ${bbox.rawXHi.toFixed(3)}] × ` +
        `[${bbox.rawYLo.toFixed(3)}, ${bbox.rawYHi.toFixed(3)}]  ` +
        `aspect ${bbox.rawAspect.toFixed(2)} (capped at ${opts.maxAspect ?? 4})  →  ` +
        `image = ${imgW}×${imgH}  in ${Date.now() - tb} ms`);

  const camera = makeOrthographicCamera({ xLo, xHi, yLo, yHi, imgW, imgH });

  return { project: composeProjector(embedding, camera), imgW, imgH, embedding, camera };
}
