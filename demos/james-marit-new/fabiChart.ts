/**
 * Fabi-style affine chart, parameterized by `t` and a display `scale`.
 *
 * Change of basis E with columns
 *   e₁ = (1, 0, −1, 0),  e₂ = (0, 1, 0, 0),
 *   e₃ = (1, 0,  1, t),  e₄ = (0, 0, 0, 1).
 * E⁻¹ has the form (top-left 3×3 fixed, last row depends on t):
 *   denom = row₄(E⁻¹) = (−t/2, 0, −t/2, 1)
 *   row₁  = (½, 0, −½, 0)   row₂ = (0, 1, 0, 0)   row₃ = (½, 0, ½, 0)
 * `scale` then multiplies the three (x,y,z) rows so the limit set is
 * visible. Fabi's original code used t = −100, scale = 300.
 */

import type { CustomChart } from '@/sl4r/types';

export const FABI_DEFAULT_T     = -100;
export const FABI_DEFAULT_SCALE = 300;

export function makeFabiChart(t: number, scale: number): CustomChart {
  const d = -t / 2;
  return {
    id: 'fabi',
    label: "Fabi's chart",
    pretty: `Fabi's chart — t=${t}, scale=${scale}`,
    denom: [d, 0, d, 1],
    rowX:  [ 0.5 * scale, 0,           -0.5 * scale, 0],
    rowY:  [ 0,           scale,        0,            0],
    rowZ:  [ 0.5 * scale, 0,            0.5 * scale,  0],
  };
}
