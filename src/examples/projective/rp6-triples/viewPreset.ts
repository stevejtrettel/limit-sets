/**
 * On-disk contract between the sl7 browser viewer and the offline render
 * (outputs/presets/sl7-view-preset.json). RP⁶ triples fit a projective chart,
 * so the preset carries the chart matrix — the shared `ChartViewPreset` from
 * core. Group tag stays 'sl7' (see the saveViewPreset call) so saved presets
 * load.
 */

import type {
  ChartViewPreset, ViewPresetCamera, ViewPresetProjection, ViewPresetViewport,
} from '../../../core/viewPreset.ts';

export type { ChartViewPreset, ViewPresetCamera, ViewPresetProjection, ViewPresetViewport };

export type ViewPreset = ChartViewPreset;
