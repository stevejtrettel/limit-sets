/**
 * sp6's only embedding-specific concern: turning a saved ViewPreset's
 * `projection` field (denom + rowX/rowY/rowZ as flat number arrays) into
 * a `ChartEmbedding`.
 *
 * The chart math + fitters themselves are dimension-agnostic and live in
 * `@/core/chart` — sp6 just chooses to project R⁶ to R³ via that mechanism.
 */

import { makeChartFromData, type ChartEmbedding } from '../core/chart.ts';
import type { ViewPresetProjection } from './viewPreset.ts';

export const SP6_STATE_DIM = 6;

/** Reconstruct the ChartEmbedding stored inside a saved ViewPreset. */
export function embeddingFromPreset(p: ViewPresetProjection): ChartEmbedding {
  return makeChartFromData({
    stateDim: SP6_STATE_DIM,
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
