/**
 * Shared pieces of the on-disk "view preset" contract between a browser demo
 * (which exports a framed view) and the offline render script (which reproduces
 * it at higher depth / resolution).
 *
 * The camera and viewport blocks are identical across all families. Families
 * that fit a projective chart (sl4r, sp6, o5) also serialise a
 * `ViewPresetProjection` and rebuild it with `makeEmbeddingFactory`; families
 * with FIXED embeddings (sl2c, sl3r) instead store an embedding name. Each
 * family composes these into its own `ViewPreset` bundle.
 */

import { makeChartFromData, type ChartEmbedding } from './chart.ts';

/** Perspective camera spec saved with a view. */
export interface ViewPresetCamera {
  position: readonly [number, number, number];
  target:   readonly [number, number, number];
  up:       readonly [number, number, number];
  fov: number;
  aspect: number;
  near: number;
  far: number;
}

export interface ViewPresetViewport {
  width: number;
  height: number;
}

/** A serialised projective chart π(v) = (R·v)/(d·v): the denominator covector
 *  `denom` (= d) and the three rows of R, all length `stateDim`. */
export interface ViewPresetProjection {
  denom: readonly number[];
  rowX: readonly number[];
  rowY: readonly number[];
  rowZ: readonly number[];
  /** Human-readable label (e.g. "autochart"). Optional. */
  label?: string;
}

/** Reconstruct the `ChartEmbedding` from a saved projection, for a fixed ambient
 *  dimension. Each charted family exports
 *  `embeddingFromPreset = makeEmbeddingFactory(stateDim)`. */
export function makeEmbeddingFactory(
  stateDim: number,
): (p: ViewPresetProjection) => ChartEmbedding {
  return (p) => makeChartFromData({
    stateDim,
    denom: [...p.denom],
    rows: [[...p.rowX], [...p.rowY], [...p.rowZ]],
    label: p.label ?? 'preset',
    pretty: p.label ?? 'preset chart',
  });
}
