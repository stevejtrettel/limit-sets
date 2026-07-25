/**
 * The RP² restriction of a Goldman–Parker triple.
 *
 * The three 7×7 involutions ⟨g₁, g₂, g₃⟩ ⊂ SL(7,ℝ) are REDUCIBLE: the orbit of
 * the limit-set basepoint spans only a 3-dimensional invariant subspace V ⊂ ℝ⁷,
 * so the whole limit set lives in ℙ(V) = RP². This module makes that reduction a
 * computation, not a footnote: it builds the 7×7 action, auto-seeds, hands the
 * seed to the generic `restrictToOrbitSpan` (core), and returns the honest 3×3
 * representation on RP² together with the certification that V is exactly
 * invariant.
 *
 * The restricted generators come out as involutions with det +1 and spectrum
 * (+1, −1, −1) — i.e. PROJECTIVE REFLECTIONS (each fixes a point and a line in
 * RP²), so ⟨C₁, C₂, C₃⟩ is a real-projective reflection group and its limit set
 * is drawn with the same rp2 sphere/plane embeddings as the sl3r triangle groups.
 */

import { type RP6Example, seedRP6 } from './data.ts';
import type { Mat } from '../../../core/matrix.ts';
import type { GroupAction } from '../../../core/group.ts';
import { makeMatrixAction, asInvolutions, normalizeSphere } from '../../../core/matrixAction.ts';
import { restrictToOrbitSpan, restrictedAction } from '../../../core/invariantSubspace.ts';

export interface RP2Restriction {
  /** The 3×3 action on RP² = ℙ(V). */
  action: GroupAction;
  /** Unit ℝ³ basepoint on Λ — the 7-D seed projected into the V-frame. */
  basepoint: Float64Array;
  /** The three restricted involutions Cᵢ = B gᵢ Bᵀ (for display / offline render). */
  generators: readonly Mat[];
  /** Human label of the seed word (from the 7×7 auto-seed). */
  seedName: string;
  lambdaMax: number;
  /** dim V (asserted = 3). */
  dim: number;
  /** max‖gᵢ Bᵀ − Bᵀ Cᵢ‖ — machine-zero certifies V is exactly invariant. */
  invarianceResidual: number;
  /** λ₃ / λ₄ of the orbit-Gram spectrum — the rank gap (∞ when the tail is 0). */
  spectralGap: number;
}

/** Build the RP² restriction of `ex`. `depth` sizes the pilot orbit used to
 *  recover V (12 fills the 3-D subspace with wide margin). */
export function restrictToRP2(ex: RP6Example, depth = 12): RP2Restriction {
  const action7 = makeMatrixAction(asInvolutions(ex.generators));
  const seed = seedRP6(action7);
  const r = restrictToOrbitSpan(action7, seed.basepoint, { depth });
  if (r.dim !== 3) {
    throw new Error(`restrictToRP2: expected a 3-D invariant subspace, got dim ${r.dim}`);
  }
  const action = restrictedAction(r);
  const basepoint = r.project(seed.basepoint);
  normalizeSphere(basepoint, 0, 3);
  return {
    action,
    basepoint,
    generators: r.alphabet.matrices,
    seedName: seed.name,
    lambdaMax: seed.lambdaMax,
    dim: r.dim,
    invarianceResidual: r.invarianceResidual,
    spectralGap: r.spectralGap,
  };
}
