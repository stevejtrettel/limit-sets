/**
 * On-disk contract between the sl4r browser viewer (which exports a framed view)
 * and the offline render script (scripts/sl4r-view-preset.json). sl4r fits a
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
