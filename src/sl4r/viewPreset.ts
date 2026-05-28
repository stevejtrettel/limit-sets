/**
 * On-disk contract between the sl4r browser viewer and the offline render
 * script. The bundle is JSON at `scripts/sl4r-view-preset.json` (the vite
 * dev-server middleware writes it there).
 *
 * sl4r ships PCA-fit charts (auto-chart, chart-PCA per axis), so the preset
 * carries the chart matrix itself — same shape as the sp6 preset.
 */

export interface ViewPresetProjection {
  /** Chart denominator vector (4 entries). */
  denom: readonly number[];
  /** Chart 3×4 matrix rows: rowX·v / denom·v → x in R³, etc. */
  rowX: readonly number[];
  rowY: readonly number[];
  rowZ: readonly number[];
  /** Human-readable label (e.g. "autochart", "v1-pca"). Optional. */
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

export interface ViewPreset {
  exampleId: string;
  previewDepth: number;
  colorScheme?: string;
  projection: ViewPresetProjection;
  camera: ViewPresetCamera;
  viewport: ViewPresetViewport;
}
