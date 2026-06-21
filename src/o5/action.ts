/**
 * o5 GroupAction — degree-5 orthogonal hypergeometric monodromy, walked over
 * the free-product alphabet {T, B}.
 *
 * Bajpai–Nitsche, "Thin Monodromy in O(5)". Each group is G = ⟨A, B⟩ in Levelt's
 * basis (eq. 1.1) with
 *     A = companion(f),   B = companion(g),
 * where f, g are the degree-5 cyclotomic products of the rotation tuples α, β.
 * The key structural fact (Theorem 1) is that G is a FREE PRODUCT
 *     G = ⟨T⟩ ∗ ⟨B⟩,     T = B·A⁻¹,     T² = I  (T is a reflection),
 * amalgamated over ±I when Bᵏ = −I. We therefore generate the orbit over the
 * alphabet {T, B, B⁻¹} rather than {A, B}: because T is an involution, the
 * non-backtracking word tree (never T·T, never B·B⁻¹) is exactly the
 * free-product normal form  B^{i₀} T B^{i₁} T ⋯ — no nodes wasted on the
 * relation A = T·B that an {A,B} alphabet would drag along.
 *
 * Generator codes:  0 = T,  1 = B,  2 = B⁻¹.   T is self-inverse.
 *
 * The proximal element is γ = T·B (paper §3: the cone F starts from
 * limᵢ (TB)ⁱ), i.e. the word [B, T] = [1, 0] in application order.
 *
 * Companion convention — the paper's SageMath `companion_matrix`: for a monic
 *     p(x) = x⁵ + c₄x⁴ + c₃x³ + c₂x² + c₁x + c₀,
 *     C·eⱼ = e_{j+1} (j=0..3),     C·e₄ = −(c₀,…,c₄)ᵀ.
 * coefflist is stored high-degree-first [1, h₁, …, h₅] with hᵢ = coeff of
 * x^{5−i}, so  c₀ = h₅, c₁ = h₄, c₂ = h₃, c₃ = h₂, c₄ = h₁. The constant term
 * c₀ = ±1 (roots on the unit circle, real polynomial), so A⁻¹ is integral.
 */

import type { GroupAction } from '../core/group.ts';

const DIM = 5;

/** Row-major 5×5 stored in a length-25 Float64Array. */
export type Mat5 = Float64Array;

/** Companion matrix of the monic poly with high-first coefficients `coeff`
 *  (length 6, leading entry 1). */
export function companion(coeff: readonly number[]): Mat5 {
  // low-to-high: c0 = const = coeff[5], …, c4 = coeff[1].
  const c = [coeff[5], coeff[4], coeff[3], coeff[2], coeff[1]];
  const M = new Float64Array(25);
  for (let j = 0; j < 4; j++) M[(j + 1) * DIM + j] = 1; // C·eⱼ = e_{j+1}
  for (let r = 0; r < DIM; r++) M[r * DIM + 4] = -c[r]; // last column = −(c₀…c₄)
  return M;
}

/** Inverse of `companion(coeff)`, derived in closed form (c₀ = ±1). */
export function companionInverse(coeff: readonly number[]): Mat5 {
  const c0 = coeff[5], c1 = coeff[4], c2 = coeff[3], c3 = coeff[2], c4 = coeff[1];
  const M = new Float64Array(25);
  // y₀ = −(c₁/c₀)x₀ + x₁,  y₁ = −(c₂/c₀)x₀ + x₂,  y₂ = −(c₃/c₀)x₀ + x₃,
  // y₃ = −(c₄/c₀)x₀ + x₄,  y₄ = −(1/c₀)x₀.
  M[0 * DIM + 0] = -c1 / c0; M[0 * DIM + 1] = 1;
  M[1 * DIM + 0] = -c2 / c0; M[1 * DIM + 2] = 1;
  M[2 * DIM + 0] = -c3 / c0; M[2 * DIM + 3] = 1;
  M[3 * DIM + 0] = -c4 / c0; M[3 * DIM + 4] = 1;
  M[4 * DIM + 0] = -1 / c0;
  return M;
}

/** Matrix product P·Q for row-major 5×5. */
export function mul5(P: Mat5, Q: Mat5): Mat5 {
  const R = new Float64Array(25);
  for (let i = 0; i < DIM; i++) {
    for (let k = 0; k < DIM; k++) {
      const pik = P[i * DIM + k];
      if (pik === 0) continue;
      for (let j = 0; j < DIM; j++) R[i * DIM + j] += pik * Q[k * DIM + j];
    }
  }
  return R;
}

/** The raw companion matrices and the derived reflection, for one group.
 *  Useful for diagnostics (det, order of B, the invariant form) beyond the
 *  bare GroupAction. */
export interface O5Matrices {
  A: Mat5; Ainv: Mat5;
  B: Mat5; Binv: Mat5;
  T: Mat5; // = B·A⁻¹, an involution
}

export function buildO5Matrices(
  coefflistf: readonly number[],
  coefflistg: readonly number[],
): O5Matrices {
  const A = companion(coefflistf);
  const Ainv = companionInverse(coefflistf);
  const B = companion(coefflistg);
  const Binv = companionInverse(coefflistg);
  const T = mul5(B, Ainv); // T = B·A⁻¹
  return { A, Ainv, B, Binv, T };
}

const O5_INVERSE = new Uint8Array([0, 2, 1]); // T self-inverse; B⁻¹↔B

function normalizeS4(buf: Float64Array, off: number): void {
  let s = 0;
  for (let i = 0; i < DIM; i++) s += buf[off + i] * buf[off + i];
  if (s === 0) return;
  const inv = 1 / Math.sqrt(s);
  for (let i = 0; i < DIM; i++) buf[off + i] *= inv;
}

/**
 * Build the O(5) action over the free-product alphabet {T, B, B⁻¹}
 * (generator codes 0 = T, 1 = B, 2 = B⁻¹) from the two high-first coefficient
 * lists (each length 6, leading entry 1).
 */
export function makeO5Action(
  coefflistf: readonly number[],
  coefflistg: readonly number[],
): GroupAction {
  const { B, Binv, T } = buildO5Matrices(coefflistf, coefflistg);
  const mats = [T, B, Binv]; // indexed by generator code

  function apply(
    gen: number,
    src: Float64Array, srcOff: number,
    dst: Float64Array, dstOff: number,
  ): void {
    const M = mats[gen];
    const s0 = src[srcOff], s1 = src[srcOff + 1], s2 = src[srcOff + 2],
          s3 = src[srcOff + 3], s4 = src[srcOff + 4];
    for (let r = 0; r < DIM; r++) {
      const b = r * DIM;
      dst[dstOff + r] =
        M[b] * s0 + M[b + 1] * s1 + M[b + 2] * s2 + M[b + 3] * s3 + M[b + 4] * s4;
    }
  }

  return {
    numGenerators: 3, // T, B, B⁻¹
    stateDim:      DIM,
    inverse:       O5_INVERSE,
    apply,
    normalize:     normalizeS4,
  };
}
