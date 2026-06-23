/**
 * sp6 GroupAction factory.
 *
 * Translates an Sp6Example's polynomial coefficient lists into the
 * companion matrices A (of f) and B (of g) and their inverses, exposed
 * through the abstract `GroupAction` interface.
 *
 * Generator codes:  0 = A,  1 = A⁻¹,  2 = B,  3 = B⁻¹.
 *
 * Both A and B follow the same shift-with-last-column pattern; only the
 * coefficient set differs (`F_C` vs `B_C`). Closing the coefficients into
 * `apply` (not passing them in per-call) lets V8 inline the hot loop.
 */

import type { GroupAction } from '../core/group.ts';
import type { Sp6Example } from './examples.ts';

const SP6_INVERSE = new Uint8Array([1, 0, 3, 2]);

function normalizeS5(buf: Float64Array, off: number): void {
  let s = 0;
  for (let i = 0; i < 6; i++) s += buf[off + i] * buf[off + i];
  if (s === 0) return;
  const inv = 1 / Math.sqrt(s);
  for (let i = 0; i < 6; i++) buf[off + i] *= inv;
}

export function makeSp6Action(ex: Sp6Example): GroupAction {
  const F_C = ex.coefflistf.slice(1, 6);
  const G_C = ex.coefflistg.slice(1, 6);
  const f1 = F_C[0], f2 = F_C[1], f3 = F_C[2], f4 = F_C[3], f5 = F_C[4];
  const g1 = G_C[0], g2 = G_C[1], g3 = G_C[2], g4 = G_C[3], g5 = G_C[4];

  function apply(
    gen: number,
    src: Float64Array, srcOff: number,
    dst: Float64Array, dstOff: number,
  ): void {
    const a = src[srcOff], b = src[srcOff + 1], c = src[srcOff + 2];
    const d = src[srcOff + 3], e = src[srcOff + 4], f = src[srcOff + 5];

    switch (gen) {
      case 0: // A = companion of f
        dst[dstOff]     = -f;
        dst[dstOff + 1] =  a - f1 * f;
        dst[dstOff + 2] =  b - f2 * f;
        dst[dstOff + 3] =  c - f3 * f;
        dst[dstOff + 4] =  d - f4 * f;
        dst[dstOff + 5] =  e - f5 * f;
        return;
      case 1: // A⁻¹
        dst[dstOff]     =  b - f1 * a;
        dst[dstOff + 1] =  c - f2 * a;
        dst[dstOff + 2] =  d - f3 * a;
        dst[dstOff + 3] =  e - f4 * a;
        dst[dstOff + 4] =  f - f5 * a;
        dst[dstOff + 5] = -a;
        return;
      case 2: // B = companion of g
        dst[dstOff]     = -f;
        dst[dstOff + 1] =  a - g1 * f;
        dst[dstOff + 2] =  b - g2 * f;
        dst[dstOff + 3] =  c - g3 * f;
        dst[dstOff + 4] =  d - g4 * f;
        dst[dstOff + 5] =  e - g5 * f;
        return;
      case 3: // B⁻¹
        dst[dstOff]     =  b - g1 * a;
        dst[dstOff + 1] =  c - g2 * a;
        dst[dstOff + 2] =  d - g3 * a;
        dst[dstOff + 3] =  e - g4 * a;
        dst[dstOff + 4] =  f - g5 * a;
        dst[dstOff + 5] = -a;
        return;
    }
  }

  return {
    numGenerators: 4,
    stateDim:      6,
    inverse:       SP6_INVERSE,
    apply,
    normalize:     normalizeS5,
  };
}
