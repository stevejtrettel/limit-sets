/**
 * Projective action of a subgroup of GL(4,R) on RP³ (sphere-cover model).
 *
 * State: homogeneous point in R⁴, normalised to S³ (|v| = 1, double cover
 * of RP³). Layout per state: [x, y, z, w].
 *
 * Two factory modes — same shape as sl3r/action.ts:
 *   - `involutions: true`  — each generator is its own inverse.
 *   - `involutions: false` (default) — each user generator g_k is paired with
 *     its inverse (computed via the standard 4×4 cofactor formula). 2k = g_k
 *     forward, 2k+1 = g_k inverse.
 */

import type { GroupAction } from '../core/group.ts';

export type Mat4R = readonly [
  readonly [number, number, number, number],
  readonly [number, number, number, number],
  readonly [number, number, number, number],
  readonly [number, number, number, number],
];

function normalizeS3(buf: Float64Array, off: number): void {
  let s = 0;
  for (let i = 0; i < 4; i++) s += buf[off + i] * buf[off + i];
  if (s === 0) return;
  const inv = 1 / Math.sqrt(s);
  for (let i = 0; i < 4; i++) buf[off + i] *= inv;
}

export function mat4Det(M: Mat4R): number {
  const a00 = M[0][0], a01 = M[0][1], a02 = M[0][2], a03 = M[0][3];
  const a10 = M[1][0], a11 = M[1][1], a12 = M[1][2], a13 = M[1][3];
  const a20 = M[2][0], a21 = M[2][1], a22 = M[2][2], a23 = M[2][3];
  const a30 = M[3][0], a31 = M[3][1], a32 = M[3][2], a33 = M[3][3];
  const b00 = a00 * a11 - a01 * a10;
  const b01 = a00 * a12 - a02 * a10;
  const b02 = a00 * a13 - a03 * a10;
  const b03 = a01 * a12 - a02 * a11;
  const b04 = a01 * a13 - a03 * a11;
  const b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30;
  const b07 = a20 * a32 - a22 * a30;
  const b08 = a20 * a33 - a23 * a30;
  const b09 = a21 * a32 - a22 * a31;
  const b10 = a21 * a33 - a23 * a31;
  const b11 = a22 * a33 - a23 * a32;
  return b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
}

export function mat4Mul(A: Mat4R, B: Mat4R): Mat4R {
  const out: number[][] = [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += A[r][k] * B[k][c];
    out[r][c] = s;
  }
  return out as unknown as Mat4R;
}

export function mat4Inverse(M: Mat4R): Mat4R {
  const a00 = M[0][0], a01 = M[0][1], a02 = M[0][2], a03 = M[0][3];
  const a10 = M[1][0], a11 = M[1][1], a12 = M[1][2], a13 = M[1][3];
  const a20 = M[2][0], a21 = M[2][1], a22 = M[2][2], a23 = M[2][3];
  const a30 = M[3][0], a31 = M[3][1], a32 = M[3][2], a33 = M[3][3];
  const b00 = a00 * a11 - a01 * a10;
  const b01 = a00 * a12 - a02 * a10;
  const b02 = a00 * a13 - a03 * a10;
  const b03 = a01 * a12 - a02 * a11;
  const b04 = a01 * a13 - a03 * a11;
  const b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30;
  const b07 = a20 * a32 - a22 * a30;
  const b08 = a20 * a33 - a23 * a30;
  const b09 = a21 * a32 - a22 * a31;
  const b10 = a21 * a33 - a23 * a31;
  const b11 = a22 * a33 - a23 * a32;
  const det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (Math.abs(det) < 1e-15) {
    throw new Error('singular 4×4 matrix; cannot invert');
  }
  const inv = 1 / det;
  return [
    [( a11 * b11 - a12 * b10 + a13 * b09) * inv,
     (-a01 * b11 + a02 * b10 - a03 * b09) * inv,
     ( a31 * b05 - a32 * b04 + a33 * b03) * inv,
     (-a21 * b05 + a22 * b04 - a23 * b03) * inv],
    [(-a10 * b11 + a12 * b08 - a13 * b07) * inv,
     ( a00 * b11 - a02 * b08 + a03 * b07) * inv,
     (-a30 * b05 + a32 * b02 - a33 * b01) * inv,
     ( a20 * b05 - a22 * b02 + a23 * b01) * inv],
    [( a10 * b10 - a11 * b08 + a13 * b06) * inv,
     (-a00 * b10 + a01 * b08 - a03 * b06) * inv,
     ( a30 * b04 - a31 * b02 + a33 * b00) * inv,
     (-a20 * b04 + a21 * b02 - a23 * b00) * inv],
    [(-a10 * b09 + a11 * b07 - a12 * b06) * inv,
     ( a00 * b09 - a01 * b07 + a02 * b06) * inv,
     (-a30 * b03 + a31 * b01 - a32 * b00) * inv,
     ( a20 * b03 - a21 * b01 + a22 * b00) * inv],
  ];
}

export interface Mat4ActionOptions {
  /** True for reflection/Coxeter-type groups (each gen is its own inverse). */
  involutions?: boolean;
}

export function makeMat4Action(
  matrices: readonly Mat4R[],
  options: Mat4ActionOptions = {},
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

  // Flat matrix table — 16 doubles per matrix, row-major.
  const mats = new Float64Array(numGen * 16);
  for (let k = 0; k < N; k++) {
    const M = matrices[k];
    const off = involutions ? k * 16 : (2 * k) * 16;
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      mats[off + r * 4 + c] = M[r][c];
    }
    if (!involutions) {
      const Mi = mat4Inverse(M);
      const offI = (2 * k + 1) * 16;
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
        mats[offI + r * 4 + c] = Mi[r][c];
      }
    }
  }

  function apply(
    gen: number,
    src: Float64Array, sOff: number,
    dst: Float64Array, dOff: number,
  ): void {
    const m = gen * 16;
    const x = src[sOff], y = src[sOff + 1], z = src[sOff + 2], w = src[sOff + 3];
    dst[dOff]     = mats[m]      * x + mats[m + 1]  * y + mats[m + 2]  * z + mats[m + 3]  * w;
    dst[dOff + 1] = mats[m + 4]  * x + mats[m + 5]  * y + mats[m + 6]  * z + mats[m + 7]  * w;
    dst[dOff + 2] = mats[m + 8]  * x + mats[m + 9]  * y + mats[m + 10] * z + mats[m + 11] * w;
    dst[dOff + 3] = mats[m + 12] * x + mats[m + 13] * y + mats[m + 14] * z + mats[m + 15] * w;
  }

  return {
    numGenerators: numGen,
    stateDim:      4,
    inverse,
    apply,
    normalize: normalizeS3,
  };
}
