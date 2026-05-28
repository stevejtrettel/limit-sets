/**
 * On-disk contract between the marked-boxes browser viewer and the offline
 * render script (`scripts/marked-boxes-render-limit-set.ts`). The bundle
 * is JSON at `scripts/marked-boxes-view-preset.json`, written by the
 * vite dev-server middleware when the demo POSTs to /__save-view/marked-boxes.
 *
 * marked-boxes is a 2D line-based viewer (not a point-cloud), so the
 * preset stores the visible chart-coords bounding box directly (computed
 * from the orbit camera at export time, assuming a straight-down view —
 * the chart already lives at z=0). The render script maps bbox → pixels
 * via a trivial affine.
 */

/** Chart-coordinate axis-aligned bounding box. */
export interface ChartBBox {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export interface ViewportSize {
  width:  number;
  height: number;
}

export interface MarkedBoxesViewPreset {
  /** Constant tag: 'marked-boxes'. */
  exampleId: 'marked-boxes';

  /** Pappus parameters in (-1, 1)² \ {(0, 0)}. */
  c: number;
  d: number;
  /** Subdivision depth (root counted as 0; depth N = 2^N leaf boxes). */
  depth: number;

  /** Visible region of the affine chart (x/(y+z), y/(y+z)) at export time. */
  bbox: ChartBBox;
  /** Aspect-defining viewport; offline render scales to --max-dim while
   *  preserving width/height ratio. */
  viewport: ViewportSize;

  /** Whether to draw the two marked points (t, b) per box as small dots. */
  showMarks?: boolean;
  /** Background paint. Default 'white' (matches the in-browser default). */
  background?: 'white' | 'black';
}
