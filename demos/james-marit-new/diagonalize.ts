/**
 * Small 3×3 / 4×4 helpers for re-expressing the cocycle in the eigenbasis of
 * the SO(2,1) generator A and for the block-diagonal 4×4 conjugation used in
 * the console log.
 *
 * In james-marit-new the generator A is supplied already diagonal, in the
 * proximal eigenbasis ordered (λ₊², 1, λ₋²) = (3+2√2, 1, 3−2√2) — so its
 * diagonalizer is the identity I₃ and main.ts uses that directly. The
 * analytic sym²-eigensolver of the original demo is therefore gone; only the
 * two row/block utilities remain.
 */

import type { Mat3R, Vec3 } from './symSquare';

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
