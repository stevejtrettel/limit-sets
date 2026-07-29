/**
 * The one-parameter pair ⟨A(t), B(t)⟩ ⊂ SL(3, ℤ[t, 1/t]).
 *
 *          ⎡  0   0  −1/t  ⎤              ⎡ −1/t  1   0 ⎤
 *   A(t) = ⎢  0  −t  t−1/t ⎥      B(t) =  ⎢  0    1   0 ⎥
 *          ⎣ −1   0  1−1/t ⎦              ⎣  0    1  −t ⎦
 *
 * Both have det = 1 identically in t, and spec A(t) = spec B(t) = spec A(t)B(t)
 * = {−t, 1, −1/t}, so tr A = tr B = tr AB = 1 − t − 1/t: a symmetric triple.
 * The rep is irreducible (the algebra ⟨A,B⟩ spans M₃) and preserves no quadratic
 * form, so the RP² limit set is not a conic.
 *
 * INTEGRALITY. The entries lie in ℤ[t, 1/t], so ⟨A(t), B(t)⟩ ⊂ SL(3, 𝒪_K) exactly
 * when t is a UNIT of the ring of integers of K = ℚ(√d) — 1/t must itself be an
 * algebraic integer. That is why `quadratic.ts` only admits t with N(t) = ±1;
 * t = √2 (norm −2) would put 1/t = √2/2 outside ℤ[√2].
 *
 * Because the matrices are ℤ[t,1/t]-rational, the Galois conjugate of the group
 * is obtained by literally substituting t ↦ t^σ — no separate conjugate data is
 * needed. That is what `recipe.ts` exploits to build the SL(3)×SL(3) embedding.
 */

import { type Mat, mat } from '../../core/matrix.ts';

export function genA(t: number): Mat {
  const ti = 1 / t;
  return mat([
    [ 0,  0, -ti],
    [ 0, -t,  t - ti],
    [-1,  0,  1 - ti],
  ]);
}

export function genB(t: number): Mat {
  const ti = 1 / t;
  return mat([
    [-ti, 1,  0],
    [  0, 1,  0],
    [  0, 1, -t],
  ]);
}

/** The generating pair at parameter t, in code order before inverses are added. */
export const generatorsAt = (t: number): [Mat, Mat] => [genA(t), genB(t)];

/** Generator-code labels for the free pair alphabet [A, A⁻¹, B, B⁻¹]. */
export const GENERATOR_LABELS = ['A', 'A⁻¹', 'B', 'B⁻¹'] as const;

/** The common eigenvalue multiset {−t, 1, −1/t} of A(t), B(t) and A(t)B(t). */
export const spectrumAt = (t: number): [number, number, number] => [-t, 1, -1 / t];
