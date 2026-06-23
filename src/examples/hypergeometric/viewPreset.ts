/**
 * On-disk contract between the hypergeometric browser viewers and the offline
 * render scripts (scripts/o5-view-preset.json, scripts/sp6-view-preset.json).
 *
 * Both catalogs fit a projective chart, so the preset carries the chart matrix —
 * the shared `ChartViewPreset` shape from core. Rebuild the embedding from a
 * saved projection with `embeddingFromPreset` (dimension inferred).
 *
 * Group tags stay 'o5' / 'sp6' (see the saveViewPreset calls) so existing saved
 * presets keep loading.
 */

import type {
  ChartViewPreset, ViewPresetCamera, ViewPresetProjection, ViewPresetViewport,
} from '../../core/viewPreset.ts';

export type { ChartViewPreset, ViewPresetCamera, ViewPresetProjection, ViewPresetViewport };

/** The full bundle (alias of the shared ChartViewPreset). */
export type ViewPreset = ChartViewPreset;
