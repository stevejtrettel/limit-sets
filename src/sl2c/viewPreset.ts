/**
 * On-disk contract between the sl2c browser viewer (which exports the
 * current framed view via the HUD's "save view" button) and the offline
 * render script (which consumes it to reproduce the same view at higher
 * BFS depth / resolution).
 *
 * The bundle is JSON at `scripts/sl2c-view-preset.json` (the vite dev-server
 * middleware writes it there).
 *
 * sl2c's embeddings (`sphereEmbedding`, `planeEmbedding`) are parameter-free
 * fixed maps — the preset just names which one to use, no chart data to
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
  /** Which sl2c example was being viewed. */
  exampleId: string;
  /** BFS depth used in the browser preview. */
  previewDepth: number;
  /** Color scheme name from the colorScheme registry. Optional. */
  colorScheme?: string;
  /** Which fixed scene embedding to use offline. */
  embedding: EmbeddingName;
  camera: ViewPresetCamera;
  viewport: ViewPresetViewport;
}
