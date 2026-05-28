/**
 * 1-cohomology class φ : F₂ → R, encoded by its values on the generators
 * (a, b). Free group, so any pair (φ(a), φ(b)) defines a class.
 *
 * Two stages of parameterisation:
 *
 *   1. A pair of constants (kA, kB) — the un-scaled cohomology class.
 *      Defaults: kA = ℓ(a), kB = 0  (matches the demo spec: φ acts as the
 *      hyperbolic translation length of a, vanishes on b).
 *
 *   2. A real scale s ∈ [0, 1] on top, giving
 *
 *          φ(a) = s · kA,   φ(b) = s · kB.
 *
 * These φ values then feed into exp(−φ(g)) · sym²(ρ(g)) in the 3×3 block
 * of the 4×4 generators.
 */

import type { HyperbolicRep } from './hypRep';
import { translationLength } from './hypRep';

export interface Cohomology {
  phiA: number;
  phiB: number;
}

export interface CohomologyMultipliers {
  kA: number;
  kB: number;
}

export const DEFAULT_S = 0.5;

/** Default (kA, kB) for a given rep: (ℓ(a), 0). */
export function defaultMultipliers(rep: HyperbolicRep): CohomologyMultipliers {
  return { kA: translationLength(rep.a), kB: 0 };
}

/** φ(g) = s · k_g — no further ℓ-multiplication. */
export function makeCohomology(kA: number, kB: number, s: number): Cohomology {
  return { phiA: s * kA, phiB: s * kB };
}
