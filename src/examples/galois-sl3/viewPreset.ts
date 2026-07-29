/**
 * On-disk contract between the galois-sl3 browser viewer and the offline render
 * (outputs/presets/galois-sl3-view-preset.json). The RP⁵ picture is framed by a
 * fitted projective chart, so the preset carries the chart matrix — the shared
 * `ChartViewPreset` from core, plus the seed mode (which basepoint the orbit
 * started from, since that changes the picture, not just the framing).
 */

import type {
  ChartViewPreset, ViewPresetCamera, ViewPresetProjection, ViewPresetViewport,
} from '../../core/viewPreset.ts';
import type { SeedMode } from './recipe.ts';

export type { ChartViewPreset, ViewPresetCamera, ViewPresetProjection, ViewPresetViewport };

export interface ViewPreset extends ChartViewPreset {
  /** Basepoint choice; absent in older presets, which mean 'join'. */
  seedMode?: SeedMode;
}
