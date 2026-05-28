/**
 * On-disk contract between the james-marit browser viewer and the offline
 * render script. The bundle is JSON at `scripts/james-marit-view-preset.json`
 * (the vite dev-server middleware writes it there).
 *
 * Unlike the sl4r demo (which has a fixed `EXAMPLES` registry and stores
 * just an `exampleId`), the james-marit demo builds its 4×4 generators
 * live from UI state, so we persist the generators themselves plus the γ
 * word so the offline render is fully self-contained.
 *
 * We re-use the camera / projection / viewport schemas from the sl4r view
 * preset since the chart and camera handling are identical.
 */

import type {
  ViewPresetProjection,
  ViewPresetCamera,
  ViewPresetViewport,
} from '@/sl4r/viewPreset';

/** A 4×4 matrix in row-major form, serialised as nested arrays. */
export type Mat4Json = readonly [
  readonly [number, number, number, number],
  readonly [number, number, number, number],
  readonly [number, number, number, number],
  readonly [number, number, number, number],
];

/**
 * Offline-render deposit mode.
 *   - 'points': existing behaviour — deposit each orbit point at its pixel.
 *   - 'rays':   for each orbit point p, project [e₄] once and draw the 2D
 *               line from p's pixel to [e₄]'s pixel into the accumulator.
 *               At s = 1 this draws the invariant rays p–[e₄] that are
 *               part of the limit set; at s ≠ 1 they're a deliberate
 *               decoration.
 *   - 'both':   do both — segments overlaid by the points.
 */
export type JMRenderMode = 'points' | 'rays' | 'both';

/**
 * Inputs that produced the generators — for offline-render filenames and
 * metadata overlays. The generators field below is the *output* of these
 * inputs (ρ + φ + α cocycle), captured at export time; these fields are
 * the inputs themselves so the render script can label the image and
 * uniquify the filename.
 */
export interface JMRepParams {
  /** Rep mode: 'modular-torus' = hardcoded (3,3,3); 'teichmuller' = (x,y) sliders. */
  repMode: 'modular-torus' | 'teichmuller';
  /** Trace coordinates (x, y) on the Teichmüller component. Meaningful only when repMode === 'teichmuller'. */
  x: number;
  y: number;
  /** Cohomology scale: φ = s · (kA, kB). */
  s: number;
  /** Cocycle coordinates in the basis (α₁ α₂ α₃) → v ∈ R⁶. */
  alphas: readonly [number, number, number];
}

export interface JMViewPreset {
  /** Constant tag: 'james-marit'. */
  exampleId: 'james-marit';
  /** Depth from the demo (orbit was previewed at this depth in the browser). */
  previewDepth: number;
  /** Color scheme name; render script may use or ignore. */
  colorScheme?: string;
  /** Offline-render deposit mode; default 'points'. */
  renderMode?: JMRenderMode;

  /** The two 4×4 generators (M(a), M(b)) computed live from ρ + φ + α. */
  generators: readonly Mat4Json[];
  /** Loxodromic γ word, as generator codes (0=A, 1=A⁻¹, 2=B, 3=B⁻¹). */
  gamma: readonly number[];
  /** Human-readable name of γ (e.g. "B"). */
  gammaName: string;
  /** Power-iteration count for basepoint. */
  powerIter: number;
  /** Whether all generators are involutions (always false for james-marit). */
  involutions: boolean;

  /** Inputs that produced `generators`; used for filenames + metadata overlay.
   *  Optional only for backward-compatibility with presets exported before
   *  this field was added; the current demo always populates it. */
  params?: JMRepParams;

  projection: ViewPresetProjection;
  camera: ViewPresetCamera;
  viewport: ViewPresetViewport;
}
