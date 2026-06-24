/**
 * On-disk contract between the james-marit browser viewer and the offline render
 * (scripts/james-marit-new-view-preset.json). The 4×4 generators are built live
 * from UI state (ρ + φ + α cocycle), so we persist the generators themselves
 * plus the γ word — the render is fully self-contained.
 *
 * Group tag stays 'james-marit-new' (saved presets key off it). Camera /
 * projection / viewport schemas are the shared core ones.
 */

import type {
  ViewPresetProjection,
  ViewPresetCamera,
  ViewPresetViewport,
} from '@/core/viewPreset';

/** A 4×4 matrix in row-major form, serialised as nested arrays. */
export type Mat4Json = readonly [
  readonly [number, number, number, number],
  readonly [number, number, number, number],
  readonly [number, number, number, number],
  readonly [number, number, number, number],
];

/** Offline-render deposit mode (rays to [e₄] are an invariant subset at s = 1). */
export type JMRenderMode = 'points' | 'rays' | 'both';

export interface JMRepParams {
  /** Cohomology scale: φ = s·(kA, kB). At s = 1, χ_A = 3 − 2√2, χ_B = 1. */
  s: number;
  /** Cocycle coordinates α₁ α₂ α₃ → v ∈ ℝ⁶. */
  alphas: readonly [number, number, number];
}

export interface JMViewPreset {
  /** Constant tag: 'james-marit-new'. */
  exampleId: 'james-marit-new';
  previewDepth: number;
  colorScheme?: string;
  renderMode?: JMRenderMode;

  /** The two 4×4 generators (M(a), M(b)) computed live from ρ + φ + α. */
  generators: readonly Mat4Json[];
  /** Loxodromic γ word, as generator codes (0=A, 1=A⁻¹, 2=B, 3=B⁻¹). */
  gamma: readonly number[];
  gammaName: string;
  powerIter: number;
  involutions: boolean;

  /** Inputs that produced `generators` (for filenames / metadata overlay). */
  params?: JMRepParams;

  projection: ViewPresetProjection;
  camera: ViewPresetCamera;
  viewport: ViewPresetViewport;
}
