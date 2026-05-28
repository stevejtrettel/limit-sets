/**
 * sl4r embeddings: turn a saved ViewPreset's projection block (denom + rowX/
 * rowY/rowZ as flat 4-vectors) into a ChartEmbedding for offline rendering.
 *
 * The chart math + PCA fitters themselves are dimension-agnostic and live in
 * @/core/chart — sl4r just chooses to project R⁴ to R³ via that mechanism.
 */

import { makeChartFromData, type ChartEmbedding } from '../core/chart.ts';
import type { ViewPresetProjection } from './viewPreset.ts';

export const SL4R_STATE_DIM = 4;

/** Reconstruct the ChartEmbedding stored inside a saved ViewPreset. */
export function embeddingFromPreset(p: ViewPresetProjection): ChartEmbedding {
  return makeChartFromData({
    stateDim: SL4R_STATE_DIM,
    denom: [...p.denom],
    rows: [
      [...p.rowX],
      [...p.rowY],
      [...p.rowZ],
    ],
    label: p.label ?? 'preset',
    pretty: p.label ?? 'preset chart',
  });
}
