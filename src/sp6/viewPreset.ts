/**
 * The on-disk contract between the browser (which exports a framed view via
 * the "save view" button) and the offline render script (which consumes it
 * to render the same view at higher BFS depth).
 *
 * The bundle is JSON; the file lives at `scripts/sp6-view-preset.json` (the
 * browser's Vite dev-server middleware writes it there).
 */

export interface ViewPresetProjection {
  /** Chart denominator vector (6 entries). */
  denom: readonly number[];
  /** Chart 3×6 matrix rows: rowX·v / denom·v → x in R³, etc. */
  rowX: readonly number[];
  rowY: readonly number[];
  rowZ: readonly number[];
  /** Human-readable label (e.g. "v1-PCA"). Optional. */
  label?: string;
}

export interface ViewPresetCamera {
  /** Eye position in world space. */
  position: readonly [number, number, number];
  /** OrbitControls target. */
  target: readonly [number, number, number];
  /** Up vector. */
  up: readonly [number, number, number];
  /** Field of view in degrees. */
  fov: number;
  aspect: number;
  near: number;
  far: number;
}

export interface ViewPresetViewport {
  width: number;
  height: number;
}

/** Full bundle written by the browser, consumed by the offline render. */
export interface ViewPreset {
  /** Which BDN example was being viewed. */
  exampleId: string;
  /** BFS depth used in the browser preview. */
  previewDepth: number;
  /** Color scheme name (matches the colorScheme registry). Optional. */
  colorScheme?: string;
  projection: ViewPresetProjection;
  camera: ViewPresetCamera;
  viewport: ViewPresetViewport;
}
