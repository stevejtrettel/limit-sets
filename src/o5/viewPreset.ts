/**
 * On-disk contract between the o5 browser viewer (which exports a framed view)
 * and the offline render script (scripts/o5-view-preset.json). o5 fits a
 * projective chart, so the preset carries the chart matrix; the shared
 * projection / camera / viewport types live in @/core/viewPreset.
 */
import type {
  ViewPresetCamera, ViewPresetProjection, ViewPresetViewport,
} from '../core/viewPreset.ts';
export type {
  ViewPresetCamera, ViewPresetProjection, ViewPresetViewport,
} from '../core/viewPreset.ts';

/** Full bundle written by the browser, consumed by the offline render. */
export interface ViewPreset {
  exampleId: string;
  previewDepth: number;
  colorScheme?: string;
  projection: ViewPresetProjection;
  camera: ViewPresetCamera;
  viewport: ViewPresetViewport;
}
