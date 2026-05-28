/**
 * On-disk contract between the sl3r browser viewer and the offline render
 * script. The bundle is JSON at `scripts/sl3r-view-preset.json` (the vite
 * dev-server middleware writes it there).
 *
 * sl3r's embeddings (`sphereEmbedding`, `planeEmbedding`) are parameter-free
 * fixed maps; the preset just names which one to use, no chart data to
 * round-trip.
 */

import type { PerspectiveSpec } from '../core/camera.ts';

export interface ViewPresetCamera extends PerspectiveSpec {
  /** Viewport aspect (W/H) at the moment of export. */
  aspect: number;
}

export interface ViewPresetViewport {
  width: number;
  height: number;
}

export type EmbeddingName = 'sphere' | 'plane';

export interface ViewPreset {
  exampleId: string;
  previewDepth: number;
  colorScheme?: string;
  embedding: EmbeddingName;
  camera: ViewPresetCamera;
  viewport: ViewPresetViewport;
}
