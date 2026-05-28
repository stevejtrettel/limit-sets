/**
 * Diagonalizer P for the SO(2,1) block sym²(ρ(a)).
 *
 * sym²(ρ(a)) ∈ SO(2,1) ⊂ SL(3,R) has eigenvalues (λ₊², 1, λ₋²) where
 * λ₊ > 1 > λ₋ > 0 are the eigenvalues of ρ(a). Eigenvectors are computed
 * analytically by lifting the 2×2 eigenvectors of ρ(a) through the
 * symmetric-square formula (no general 3×3 eigensolver needed).
 *
 * Columns of P are ordered DESCENDING: (eigval=λ₊², eigval=1, eigval=λ₋²).
 * This ordering is chosen so that at s=1 the φ-twist exp(-ℓ(a))·sym²(ρ(a))
 * reads diag(1, λ₋², λ₋⁴) — i.e. the proximal/Anosov normalization with
 * the leading eigenvalue at (1,1).
 *
 * In the (x², xy, y²) basis used by symSquare.ts, with u = ρ(a)-eigvec for
 * λ₊ and w = ρ(a)-eigvec for λ₋:
 *   col(eigval = λ₊²) = (u₁²,    u₁u₂,              u₂²)
 *   col(eigval = 1)   = (u₁w₁,   (u₁w₂ + u₂w₁)/2,   u₂w₂)
 *   col(eigval = λ₋²) = (w₁²,    w₁w₂,              w₂²)
 */

import { trace2, det2, type Mat2R } from './hypRep';
import type { Mat3R, Vec3 } from './symSquare';

type Vec2 = readonly [number, number];

/**
 * Eigenvalues and eigenvectors of a 2×2 real matrix with disc ≥ 0.
 * Eigenvalues sorted DESCENDING: values[0] = λ₊, values[1] = λ₋.
 * vectors[i] is a (non-normalized) eigenvector for values[i].
 * Throws if the discriminant is negative (no real eigendecomposition).
 */
export function eigen2(M: Mat2R): { values: [number, number]; vectors: [Vec2, Vec2] } {
  const tr = trace2(M);
  const det = det2(M);
  const disc = tr * tr - 4 * det;
  if (disc < 0) {
    throw new Error(`eigen2: complex eigenvalues (disc=${disc}); matrix must be hyperbolic over R`);
  }
  const sqrtD = Math.sqrt(disc);
  const lPlus  = (tr + sqrtD) / 2;
  const lMinus = (tr - sqrtD) / 2;
  return {
    values:  [lPlus, lMinus],
    vectors: [eigvec2(M, lPlus), eigvec2(M, lMinus)],
  };
}

/**
 * Right eigenvector of M for eigenvalue λ. Picks the row of (M − λI) with
 * larger L¹ norm for numerical stability and returns its orthogonal vector.
 */
function eigvec2(M: Mat2R, lambda: number): Vec2 {
  const a = M[0][0] - lambda, b = M[0][1];
  const c = M[1][0],         d = M[1][1] - lambda;
  const n1 = Math.abs(a) + Math.abs(b);
  const n2 = Math.abs(c) + Math.abs(d);
  return n1 >= n2 ? [-b, a] : [-d, c];
}

/**
 * P = diagonalizer of sym²(ρ_a), columns ordered (eigval=λ₊², 1, λ₋²).
 * P⁻¹ · sym²(ρ_a) · P = diag(λ₊², 1, λ₋²).
 */
export function diagonalizerForSym2A(rhoA: Mat2R): Mat3R {
  const { vectors } = eigen2(rhoA);
  const u = vectors[0], w = vectors[1];
  const u1 = u[0], u2 = u[1];
  const w1 = w[0], w2 = w[1];
  return [
    [u1 * u1, u1 * w1,                  w1 * w1],
    [u1 * u2, (u1 * w2 + u2 * w1) / 2,  w1 * w2],
    [u2 * u2, u2 * w2,                  w2 * w2],
  ];
}

/** Row vector × 3×3 matrix → row vector. */
export function rowMul3(v: Vec3, M: Mat3R): Vec3 {
  return [
    v[0] * M[0][0] + v[1] * M[1][0] + v[2] * M[2][0],
    v[0] * M[0][1] + v[1] * M[1][1] + v[2] * M[2][1],
    v[0] * M[0][2] + v[1] * M[1][2] + v[2] * M[2][2],
  ];
}

/** Block-diagonal 4×4: M in the top-left 3×3, scalar `corner` at (4,4). */
export function block4(M: Mat3R, corner: number): readonly [
  readonly [number, number, number, number],
  readonly [number, number, number, number],
  readonly [number, number, number, number],
  readonly [number, number, number, number],
] {
  return [
    [M[0][0], M[0][1], M[0][2], 0],
    [M[1][0], M[1][1], M[1][2], 0],
    [M[2][0], M[2][1], M[2][2], 0],
    [0,       0,       0,       corner],
  ];
}
