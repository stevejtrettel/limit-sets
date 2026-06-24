/**
 * On-disk contract between the sl4r browser viewer and the offline render
 * (scripts/sl4r-view-preset.json). RP³ pairs fit a projective chart, so the
 * preset carries the chart matrix — the shared `ChartViewPreset` from core.
 * Group tag stays 'sl4r' (see the saveViewPreset call) so saved presets load.
 */

import type {
  ChartViewPreset, ViewPresetCamera, ViewPresetProjection, ViewPresetViewport,
} from '../../../core/viewPreset.ts';

export type { ChartViewPreset, ViewPresetCamera, ViewPresetProjection, ViewPresetViewport };

export type ViewPreset = ChartViewPreset;
