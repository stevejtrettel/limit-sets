/**
 * Projective action of a subgroup of GL(3,R) on RP² (sphere-cover model).
 *
 * State: homogeneous point in R³, normalised to S² (|v| = 1, double cover
 * of RP²). Layout per state: [x, y, z].
 *
 * Two factory modes:
 *   - `involutions: true`  — each generator is its own inverse (Coxeter /
 *     reflection groups). Generator code maps 1:1 to the input matrix list,
 *     and the orbit walker's non-backtracking rule (`skip g === inverse[prev]`)
 *     becomes "no immediate repeat" — i.e. exactly the reduced-word condition
 *     for Coxeter groups. Node count grows as 3·2^N (much slower than free).
 *   - `involutions: false` (default) — each user generator g_k is paired with
 *     its inverse (computed via the 3×3 cofactor formula). 2k = g_k forward,
 *     2k+1 = g_k inverse.
 */

import type { GroupAction } from '../core/group.ts';

export type Mat3R = readonly [
  readonly [number, number, number],
  readonly [number, number, number],
  readonly [number, number, number],
];

function normalizeS2(buf: Float64Array, off: number): void {
  let s = 0;
  for (let i = 0; i < 3; i++) s += buf[off + i] * buf[off + i];
  if (s === 0) return;
  const inv = 1 / Math.sqrt(s);
  for (let i = 0; i < 3; i++) buf[off + i] *= inv;
}

export function mat3Det(M: Mat3R): number {
  const a = M[0][0], b = M[0][1], c = M[0][2];
  const d = M[1][0], e = M[1][1], f = M[1][2];
  const g = M[2][0], h = M[2][1], i = M[2][2];
  return a*(e*i - f*h) - b*(d*i - f*g) + c*(d*h - e*g);
}

function mat3Inverse(M: Mat3R): Mat3R {
  const a = M[0][0], b = M[0][1], c = M[0][2];
  const d = M[1][0], e = M[1][1], f = M[1][2];
  const g = M[2][0], h = M[2][1], i = M[2][2];
  const det = mat3Det(M);
  if (Math.abs(det) < 1e-15) {
    throw new Error('singular 3×3 matrix; cannot invert');
  }
  const inv = 1 / det;
  return [
    [ (e*i - f*h)*inv, -(b*i - c*h)*inv,  (b*f - c*e)*inv],
    [-(d*i - f*g)*inv,  (a*i - c*g)*inv, -(a*f - c*d)*inv],
    [ (d*h - e*g)*inv, -(a*h - b*g)*inv,  (a*e - b*d)*inv],
  ];
}

export interface Mat3ActionOptions {
  /** True for reflection/Coxeter groups (each gen is its own inverse). */
  involutions?: boolean;
}

export function makeMat3Action(
  matrices: readonly Mat3R[],
  options: Mat3ActionOptions = {},
): GroupAction {
  const involutions = options.involutions ?? false;
  const N = matrices.length;
  const numGen = involutions ? N : 2 * N;
  if (numGen > 255) {
    throw new Error(`too many generators (${numGen}); BASEPOINT_SENTINEL=255 caps it`);
  }

  const inverse = new Uint8Array(numGen);
  if (involutions) {
    for (let k = 0; k < N; k++) inverse[k] = k;
  } else {
    for (let k = 0; k < N; k++) {
      inverse[2 * k]     = 2 * k + 1;
      inverse[2 * k + 1] = 2 * k;
    }
  }

  // Flat matrix table — 9 doubles per matrix, row-major.
  const mats = new Float64Array(numGen * 9);
  for (let k = 0; k < N; k++) {
    const M = matrices[k];
    const off = involutions ? k * 9 : (2 * k) * 9;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      mats[off + r * 3 + c] = M[r][c];
    }
    if (!involutions) {
      const Mi = mat3Inverse(M);
      const offI = (2 * k + 1) * 9;
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
        mats[offI + r * 3 + c] = Mi[r][c];
      }
    }
  }

  function apply(
    gen: number,
    src: Float64Array, sOff: number,
    dst: Float64Array, dOff: number,
  ): void {
    const m = gen * 9;
    const x = src[sOff], y = src[sOff + 1], z = src[sOff + 2];
    dst[dOff]     = mats[m]     * x + mats[m + 1] * y + mats[m + 2] * z;
    dst[dOff + 1] = mats[m + 3] * x + mats[m + 4] * y + mats[m + 5] * z;
    dst[dOff + 2] = mats[m + 6] * x + mats[m + 7] * y + mats[m + 8] * z;
  }

  return {
    numGenerators: numGen,
    stateDim:      3,
    inverse,
    apply,
    normalize: normalizeS2,
  };
}
