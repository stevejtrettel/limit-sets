/**
 * Möbius (PSL(2,C)) action on the Riemann sphere CP¹ via homogeneous coords.
 *
 * State: (z, w) ∈ C², stored as the Float64 quartet [Re z, Im z, Re w, Im w]
 * normalised to |z|² + |w|² = 1 — a point on S³, the double cover of CP¹.
 *
 * This is the sanctioned "write your own action" case: a complex 2×2 matvec
 * reads closer to the math than a realified 4×4 would, so this family keeps its
 * bespoke `apply` rather than going through the generic matrix engine. It still
 * shares `normalizeSphere` with core.
 *
 * Generator codes (for N user-supplied generators):
 *   code 2k     = g_{k+1}            (k = 0..N−1)
 *   code 2k+1   = g_{k+1}⁻¹
 *
 * Inverse for SL(2,C):  inv [[a, b], [c, d]] = [[d, −b], [−c, a]]  (det = 1).
 */

import type { GroupAction } from '../../core/group.ts';
import { normalizeSphere } from '../../core/matrixAction.ts';

/** A 2×2 complex matrix; each entry is a (re, im) pair. */
export interface ComplexMat2 {
  a: readonly [number, number];  // top-left
  b: readonly [number, number];  // top-right
  c: readonly [number, number];  // bottom-left
  d: readonly [number, number];  // bottom-right
}

export function makeMobiusAction(generators: readonly ComplexMat2[]): GroupAction {
  const N = generators.length;
  const numGen = 2 * N;
  if (numGen > 255) {
    throw new Error(`too many generators (${numGen}); BASEPOINT_SENTINEL=255 caps it`);
  }

  // Inverse pairing: 2k ↔ 2k+1.
  const inverse = new Uint8Array(numGen);
  for (let k = 0; k < N; k++) {
    inverse[2 * k]     = 2 * k + 1;
    inverse[2 * k + 1] = 2 * k;
  }

  // Flat table: 8 doubles per matrix, 16 doubles per generator (forward + inv).
  const mats = new Float64Array(numGen * 8);
  for (let k = 0; k < N; k++) {
    const G = generators[k];
    const m = k * 16;
    // Forward (code 2k)
    mats[m]      = G.a[0]; mats[m + 1]  = G.a[1];
    mats[m + 2]  = G.b[0]; mats[m + 3]  = G.b[1];
    mats[m + 4]  = G.c[0]; mats[m + 5]  = G.c[1];
    mats[m + 6]  = G.d[0]; mats[m + 7]  = G.d[1];
    // Inverse (code 2k+1): [[d, −b], [−c, a]]
    mats[m + 8]  =  G.d[0]; mats[m + 9]  =  G.d[1];
    mats[m + 10] = -G.b[0]; mats[m + 11] = -G.b[1];
    mats[m + 12] = -G.c[0]; mats[m + 13] = -G.c[1];
    mats[m + 14] =  G.a[0]; mats[m + 15] =  G.a[1];
  }

  function apply(
    gen: number,
    src: Float64Array, sOff: number,
    dst: Float64Array, dOff: number,
  ): void {
    const m = gen * 8;
    const ar = mats[m],     ai = mats[m + 1];
    const br = mats[m + 2], bi = mats[m + 3];
    const cr = mats[m + 4], ci = mats[m + 5];
    const dr = mats[m + 6], di = mats[m + 7];
    const zr = src[sOff],     zi = src[sOff + 1];
    const wr = src[sOff + 2], wi = src[sOff + 3];
    // (z', w') = (a·z + b·w, c·z + d·w), complex
    dst[dOff]     = ar * zr - ai * zi + br * wr - bi * wi;
    dst[dOff + 1] = ar * zi + ai * zr + br * wi + bi * wr;
    dst[dOff + 2] = cr * zr - ci * zi + dr * wr - di * wi;
    dst[dOff + 3] = cr * zi + ci * zr + dr * wi + di * wr;
  }

  return {
    numGenerators: numGen,
    stateDim:      4,
    inverse,
    apply,
    normalize: (buf, off) => normalizeSphere(buf, off, 4),
  };
}
