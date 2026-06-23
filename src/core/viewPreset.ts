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

/** Reconstruct the `ChartEmbedding` from a saved projection. The ambient
 *  dimension is inferred from `denom.length`, so this is fully generic — every
 *  charted family shares this one function (no per-family `embeddingFromPreset`
 *  stub keyed to a hard-coded stateDim). */
export function embeddingFromPreset(p: ViewPresetProjection): ChartEmbedding {
  return makeChartFromData({
    stateDim: p.denom.length,
    denom: [...p.denom],
    rows: [[...p.rowX], [...p.rowY], [...p.rowZ]],
    label: p.label ?? 'preset',
    pretty: p.label ?? 'preset chart',
  });
}

/** Reconstruct the `ChartEmbedding` from a saved projection, asserting a fixed
 *  ambient dimension. Kept for the per-family `embeddingFromPreset =
 *  makeEmbeddingFactory(stateDim)` stubs during the refactor; prefer the
 *  dimension-inferring {@link embeddingFromPreset}. */
export function makeEmbeddingFactory(
  stateDim: number,
): (p: ViewPresetProjection) => ChartEmbedding {
  return (p) => {
    if (p.denom.length !== stateDim) {
      throw new Error(`preset denom length ${p.denom.length} != expected stateDim ${stateDim}`);
    }
    return embeddingFromPreset(p);
  };
}

/** Saved-view bundle for families that serialise a fitted projective chart
 *  (the charted families: degree-5/6 hypergeometric, RP³ pairs). */
export interface ChartViewPreset {
  exampleId: string;
  previewDepth: number;
  colorScheme?: string;
  projection: ViewPresetProjection;
  camera: ViewPresetCamera;
  viewport: ViewPresetViewport;
}

/** Saved-view bundle for families with a FIXED, named embedding (Möbius CP¹,
 *  convex-projective RP²): the embedding is identified by name, not serialised. */
export interface NamedViewPreset {
  exampleId: string;
  previewDepth: number;
  colorScheme?: string;
  embedding: string;
  camera: ViewPresetCamera;
  viewport: ViewPresetViewport;
}
