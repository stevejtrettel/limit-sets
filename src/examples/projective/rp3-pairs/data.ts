/**
 * Two-generator subgroups of GL(4,ℝ) acting on RP³ — the "pair" examples for the
 * sl4r-limit-sets viewer.
 *
 * A catalog: data + the small glue to build a GroupAction from it. Generators
 * are flat `Mat` (built with `mat([[…]])`); the action is
 *   makeMatrixAction(pairWithInverses(example.generators))   // free pair
 * (or asInvolutions when involutions = true). Unlike the integer symplectic /
 * orthogonal families these live in plain GL(4,ℝ) — projectively only
 * invertibility matters, so det need not be ±1.
 *
 * (Migrated from demos/sl4r-limit-sets/pair1.ts into the library so the offline
 * render script no longer reaches into a demo folder.)
 */

import { type Mat, mat } from '../../../core/matrix.ts';

/** A hand-picked named chart π(v) = (rowX·v, rowY·v, rowZ·v)/(denom·v), stored
 *  as data (not a fitted object). */
export interface CustomChart {
  id: string;
  label: string;
  pretty?: string;
  denom: readonly [number, number, number, number];
  rowX:  readonly [number, number, number, number];
  rowY:  readonly [number, number, number, number];
  rowZ:  readonly [number, number, number, number];
}

export interface RP3Example {
  id: string;
  label: string;
  description: string;
  generators: readonly Mat[];
  /** True if every generator is an involution. */
  involutions: boolean;
  /** Loxodromic γ word (apply-order generator codes). */
  gamma: readonly number[];
  gammaName: string;
  powerIter: number;
  /** Named hand-picked charts attached to this example. */
  customCharts?: readonly CustomChart[];
}

// ─── pair-1 ──────────────────────────────────────────────────────────────────
// s = (7 − 3√5)/2 ≈ 0.146, a root of x² − 7x + 1; its conjugate 1/s ≈ 6.854.
// Both A and B fix [e₄] = [0:0:0:1]. Eigenvalues — A: {1,1,s,s²} (not loxodromic);
// B: {1,1,s,1/s}, dominant 1/s simple ⇒ loxodromic, so γ = B suffices.

const S = (7 - 3 * Math.sqrt(5)) / 2;
const SQRT5 = Math.sqrt(5);

const A_PAIR1 = mat([
  [4 * S, 4 * S,     S, 0],
  [2 * S, 3 * S,     S, 0],
  [    S, 2 * S,     S, 0],
  [    8,     3,     2, 1],
]);

const B_PAIR1 = mat([
  [ 4,        -4,        1,        0],
  [-2,         3,       -1,        0],
  [ 1,        -2,        1,        0],
  [ SQRT5, 2 * SQRT5, SQRT5,       1],
]);

// "Fabi's chart" — affine chart from Fabi Bender's plotLimitSet, scaled ×300 so
// the tiny limit set is visible.
const FABI_CHART: CustomChart = {
  id: 'fabi',
  label: "Fabi's chart",
  pretty: "Fabi's chart — denom=(50, 0, 50, 1), ×300 display scale",
  denom: [50, 0, 50, 1],
  rowX:  [ 150, 0, -150, 0],
  rowY:  [   0, 300, 0,  0],
  rowZ:  [ 150, 0,  150, 0],
};

export const EXAMPLES: readonly RP3Example[] = [
  {
    id: 'pair1',
    label: 'pair-1 (s = (7−3√5)/2)',
    description:
      'Two-generator subgroup ⟨A, B⟩ ⊂ GL(4,R). Both fix [e₄]; B is loxodromic ' +
      'with eigenvalues {1, 1, s, 1/s}, so γ = B drives power-iteration to its 1/s-eigenline.',
    generators: [A_PAIR1, B_PAIR1],
    involutions: false,
    gamma:     [2], // code 2 = B (codes 0=A, 1=A⁻¹, 2=B, 3=B⁻¹)
    gammaName: 'B',
    powerIter: 80,
    customCharts: [FABI_CHART],
  },
];

export function exampleById(id: string): RP3Example {
  const ex = EXAMPLES.find((e) => e.id === id);
  if (!ex) throw new Error(`unknown rp3-pairs example id: ${id}`);
  return ex;
}
