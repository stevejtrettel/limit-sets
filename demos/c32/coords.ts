/**
 * C-32 coordinate systems (stage 2 of the pipeline; see implementation.md).
 *
 * The orbit is computed once in the companion basis (the repo's A₀,B₀), giving
 * points x ∈ ℝ⁶. A "coordinate system" is a projective map M applied to those
 * points: z = M·x are the coordinates we then chart. Because the chart reads
 * z_d = (row d of M)·x, the affine patch (stage 3) and view axes (stage 4) are
 * just *selected rows of M* — no orbit copy, one render path.
 *
 *   companion : M = I       (the paper's A₀,B₀ basis)
 *   u-basis   : M = P⁻¹      (normal form: B₀→S signed shift, T₀→T transvection)
 *
 * Why P⁻¹ and not P: the paper defines P by its columns
 *   P = [v, −B₀v, B₀²v, −B₀³v, B₀⁴v, −B₀⁵v],
 * so P's columns ARE the u-basis vectors written in companion coordinates.
 * Hence x = P·y and y = P⁻¹·x: the transform on *coordinates* is the inverse of
 * the basis matrix. (Cross-check: P⁻¹B₀P = S, as in the note.) det P = −64;
 * projective, so the scale is irrelevant.
 */

import { I6, invert6 } from './mat6';

/** P (paper p.2): columns are the u-basis vectors in companion coords. */
export const P: readonly (readonly number[])[] = [
  [  0,   5,  11,  14,  11,   5],
  [  5,   0,  -5, -11, -14, -11],
  [-11,  -5,   0,   5,  11,  14],
  [ 14,  11,   5,   0,  -5, -11],
  [-11, -14, -11,  -5,   0,   5],
  [  5,  11,  14,  11,   5,   0],
];

const P_INV = invert6(P);

export interface CoordSystem {
  readonly id: string;
  readonly label: string;
  /** z = M·x: maps companion coords x to this system's coords z (row-major). */
  readonly M: readonly (readonly number[])[];
}

export const COORD_SYSTEMS: readonly CoordSystem[] = [
  { id: 'companion', label: 'companion (A₀, B₀)', M: I6 },
  { id: 'u',         label: 'u-basis (P⁻¹: S, T)', M: P_INV },
];

export function coordSystemById(id: string): CoordSystem {
  return COORD_SYSTEMS.find((c) => c.id === id) ?? COORD_SYSTEMS[0];
}
