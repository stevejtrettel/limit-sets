/**
 * 1-cohomology class φ : F₂ → ℝ, encoded by its values on the generators (a, b).
 * The free group means any pair (φ(a), φ(b)) defines a class.
 *
 * Two stages:
 *   1. multipliers (kA, kB) — the un-scaled class (defaults (ℓ(a), 0); see
 *      so21Rep.defaultMultipliers).
 *   2. a real scale s ∈ [0, 1]:  φ(a) = s·kA,  φ(b) = s·kB.
 *
 * These feed exp(−φ(g)) · ρ(g) in the 3×3 block of the 4×4 generators.
 */

export interface Cohomology {
  phiA: number;
  phiB: number;
}

/** Default scale; s = 1 reproduces the reference character χ_A = 3 − 2√2 (χ_B = 1). */
export const DEFAULT_S = 1;

/** φ(g) = s · k_g. */
export function makeCohomology(kA: number, kB: number, s: number): Cohomology {
  return { phiA: s * kA, phiB: s * kB };
}
