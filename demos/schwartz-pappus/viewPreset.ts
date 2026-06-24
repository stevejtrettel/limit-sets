/**
 * On-disk contract between the Schwartz–Pappus browser viewer and the
 * offline render script. The bundle is JSON at
 * `scripts/schwartz-pappus-view-preset.json` (the vite dev-server
 * middleware writes it there).
 *
 * The Pappus rep is built live from (c, d, b) in the demo — we persist
 * those for traceability and to label outputs, but also persist the
 * computed 3×3 generators directly so the render script is fully
 * self-contained (does not need to re-import the Pappus math).
 *
 * Camera / viewport / embedding-name schemas are reused from sl3r's
 * view preset, since both pictures live on RP² with the same plane
 * and sphere embeddings.
 */

import type {
  ViewPresetCamera,
  ViewPresetViewport,
} from '@/core/viewPreset';

/**
 * Embeddings available in the Schwartz–Pappus demo. Currently 'plane' and
 * 'sphere' (both 3-dim state). Future flag-variety visualizations will
 * extend this — see flagEmbedding.ts skeleton for the planned approaches
 * (e.g. 'flag-decorated' for decorated 2D, 'flag-dual' for dual scatter).
 * Defined here rather than in src/sl3r so the latter stays generic.
 */
export type PappusEmbeddingName = 'plane' | 'sphere';

/** A 3×3 matrix in row-major form, serialised as nested arrays. */
export type Mat3Json = readonly [
  readonly [number, number, number],
  readonly [number, number, number],
  readonly [number, number, number],
];

export interface PappusParamsJson {
  /** Pappus parameter c ∈ (-1, 1). */
  c: number;
  /** Pappus parameter d ∈ (-1, 1). */
  d: number;
  /** BLV morphing parameter b ≥ 1 (b = 1 is Pappus, b > 1 is Anosov interior). */
  b: number;
  /** Anosov-branch root of ψ(a, b, c, d) = 0; informational only. */
  a: number;
}

export interface SchwartzPappusViewPreset {
  /** Constant tag: 'schwartz-pappus'. */
  exampleId: 'schwartz-pappus';
  /** Depth from the demo (orbit was previewed at this depth in the browser). */
  previewDepth: number;
  /** Color scheme name; render script may use or ignore. */
  colorScheme?: string;
  /** Embedding name (plane / sphere; flag variants TBD). */
  embedding: PappusEmbeddingName;

  /** Pappus + morphing parameters at the moment of export (for labelling). */
  params: PappusParamsJson;

  /** The two 3×3 generators (g₁ = r₁, g₂ = Σ⁻¹·r₂·Σ). */
  generators: readonly Mat3Json[];
  /** Loxodromic γ word, as generator codes (0=g₁, 1=g₁⁻¹, 2=g₂, 3=g₂⁻¹). */
  gamma: readonly number[];
  /** Human-readable name of γ (e.g. "r₁·r₂²"). */
  gammaName: string;
  /** Power-iteration count for basepoint. */
  powerIter: number;
  /** Always false for Schwartz–Pappus (order-3 generators, not involutions). */
  involutions: boolean;

  camera: ViewPresetCamera;
  viewport: ViewPresetViewport;
}
