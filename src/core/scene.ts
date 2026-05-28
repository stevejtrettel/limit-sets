/**
 * SceneEmbedding — state in the group's ambient space → point in R³.
 *
 * This is the single place where a group's geometry meets the picture.
 * Everything upstream (GroupAction, orbit walkers) lives entirely in
 * R^stateDim; everything downstream (Camera, accumulator) lives entirely
 * in R³ → pixel. The embedding is the bridge.
 *
 * 2D limit sets just leave z = 0 — keeps every Camera implementation
 * uniform, and the three.js scene unchanged. A Camera2D shortcut can be
 * added later if it ever matters.
 *
 * Implementations live with their group (e.g. sp6's chart embeddings in
 * src/sp6/embedding.ts), not here.
 */

import type { Camera } from './camera.ts';
import type { Orbit } from './orbit.ts';

export interface SceneEmbedding {
  /** stateDim of the GroupAction this embedding accepts. */
  readonly stateDim: number;
  /**
   * Write the embedded (x, y, z) of the state at (buf, off) into
   * out[outOff..outOff+3). Returns false if the state should be skipped
   * (e.g. chart-singular, behind a horizon, NaN).
   */
  embed(
    buf: Float64Array, off: number,
    out: Float64Array, outOff: number,
  ): boolean;
  /** Short tag for filenames and cache keys. */
  readonly label: string;
  /** Human-readable description for status lines. */
  readonly pretty: string;
}

/**
 * Per-state projector: state → pixel (or null if skipped). Composed from a
 * SceneEmbedding + a Camera; both halves are independently swappable.
 */
export type Projector = (
  state: Float64Array, off: number,
) => { px: number; py: number } | null;

/**
 * Compose a SceneEmbedding with a Camera. The closure owns one 3-double
 * scratch buffer so per-call cost is: one embed + one camera.project + the
 * returned {px, py} object.
 */
export function composeProjector(
  embedding: SceneEmbedding,
  camera: Camera,
): Projector {
  const scratch = new Float64Array(3);
  return (state, off) => {
    if (!embedding.embed(state, off, scratch, 0)) return null;
    return camera.project(scratch[0], scratch[1], scratch[2]);
  };
}

/**
 * Run an embedding over an entire stored orbit, packing the surviving R³
 * points into `out` (length ≥ orbit.count · 3). Returns the number of
 * kept points. Useful for feeding scene points to autofit cameras or to
 * a GPU vertex buffer in one pass.
 */
export function embedOrbit(
  embedding: SceneEmbedding,
  orbit: Orbit,
  out: Float64Array,
): number {
  const { vecs, count } = orbit;
  const stride = embedding.stateDim;
  let kept = 0;
  for (let i = 0; i < count; i++) {
    if (embedding.embed(vecs, i * stride, out, kept * 3)) kept++;
  }
  return kept;
}
