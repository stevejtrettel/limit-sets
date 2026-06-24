/**
 * Hypergeometric monodromy — the shared recipe behind BOTH the degree-5
 * orthogonal atlas and the degree-6 symplectic tables.
 *
 * A hypergeometric monodromy group is ⟨A, B⟩ where A, B are the companion
 * matrices of the cyclotomic products of two rotation tuples α, β:
 *   A = companion(∏(x − e^{2πiαⱼ})),   B = companion(∏(x − e^{2πiβⱼ})).
 * "O(5)" vs "Sp(6)" is an emergent property of the tuples (the invariant form
 * comes out symmetric in odd degree, alternating in even degree) — NOT a
 * separate construction. The degree is just `α.length`.
 *
 * The one genuine choice is the generating set you WALK:
 *   - 'free'         — {A, A⁻¹, B, B⁻¹}, the plain free group (degree-6 symplectic).
 *   - 'free-product' — {T, B} with T = B·A⁻¹ an involution (degree-5 orthogonal;
 *                      Bajpai–Nitsche "Thin Monodromy in O(5)", Thm 1). The
 *                      non-backtracking tree is exactly the free-product normal
 *                      form, so no nodes are wasted on the relation A = T·B.
 *
 * This module is a USE of the generic engine (core/matrix + core/matrixAction +
 * core/polynomial), not core itself — it carries no example data.
 */

import { type Mat, companion, matMul, matInverse, identity, matDim } from '../../core/matrix.ts';
import { makeMatrixAction, generatingSet, pairWithInverses, type Alphabet } from '../../core/matrixAction.ts';
import { cyclotomicProduct } from '../../core/polynomial.ts';
import type { GroupAction } from '../../core/group.ts';

export type Walk = 'free' | 'free-product';

/** Display labels for each generator code, per walk. Used by formatWord and the
 *  palettes ({T,B,B⁻¹} for free-product; {A,A⁻¹,B,B⁻¹} for free). */
export const WALK_LABELS: Record<Walk, readonly string[]> = {
  'free':         ['A', 'A⁻¹', 'B', 'B⁻¹'],
  'free-product': ['T', 'B', 'B⁻¹'],
};

/** The parabolic γ to fall back to per walk when no loxodromic word is found.
 *  free-product: [1,0] = T·B (apply B then T); free: [0,2] = B·A (apply A then B). */
export const WALK_FALLBACK: Record<Walk, readonly number[]> = {
  'free':         [0, 2],
  'free-product': [1, 0],
};

/** Companion matrices A = comp(f), B = comp(g) from rotation tuples α, β. */
export function hypergeometricMatrices(
  alpha: readonly string[], beta: readonly string[],
): { A: Mat; B: Mat } {
  return { A: companion(cyclotomicProduct(alpha)), B: companion(cyclotomicProduct(beta)) };
}

const EPS_INVOLUTION = 1e-7;

/** Build the alphabet for a given walk from the companion pair (A, B). */
export function companionPairAlphabet(A: Mat, B: Mat, walk: Walk): Alphabet {
  if (walk === 'free') return pairWithInverses([A, B]);
  // free-product: T = B·A⁻¹ must be an involution (Bajpai–Nitsche Thm 1).
  const T = matMul(B, matInverse(A));
  const n = matDim(T);
  const T2 = matMul(T, T);
  const I = identity(n);
  let dev = 0;
  for (let i = 0; i < T2.length; i++) dev = Math.max(dev, Math.abs(T2[i] - I[i]));
  if (dev > EPS_INVOLUTION) {
    throw new Error(`free-product walk: T = B·A⁻¹ is not an involution (‖T²−I‖ = ${dev.toExponential(2)})`);
  }
  return generatingSet([{ M: T, involution: true }, { M: B }]);
}

/** The GroupAction for the companion pair (A, B) directly from their polynomial
 *  coefficient lists (high-degree-first, leading 1). Use when the integer
 *  polynomials are the authoritative data — e.g. the curated symplectic examples
 *  store coefflists rather than parseable rotation tuples. */
export function hypergeometricActionFromCoeffs(
  coefflistf: readonly number[], coefflistg: readonly number[], walk: Walk = 'free',
): GroupAction {
  return makeMatrixAction(companionPairAlphabet(companion(coefflistf), companion(coefflistg), walk));
}

/** The GroupAction for one hypergeometric group, given its rotation tuples and
 *  the generating set to walk. */
export function hypergeometricAction(
  alpha: readonly string[], beta: readonly string[], walk: Walk = 'free',
): GroupAction {
  const { A, B } = hypergeometricMatrices(alpha, beta);
  return makeMatrixAction(companionPairAlphabet(A, B, walk));
}
