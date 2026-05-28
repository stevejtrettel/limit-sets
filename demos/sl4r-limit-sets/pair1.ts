/**
 * The "pair-1" example for the sl4r-limit-sets demo:
 *   - two hand-picked matrices A, B ∈ GL(4,R)
 *   - γ = B (loxodromic with dominant eigenvalue 1/s ≈ 6.854)
 *   - Fabi Bender's affine chart for displaying the limit set in RP³
 *
 * Lives in the demo folder, not src/sl4r/, because it's specific to this
 * demo. Other demos (e.g. james-marit) build their own examples.
 */

import type { Mat4R } from '@/sl4r/action';
import type { SL4RExample, CustomChart } from '@/sl4r/types';

// s = (7 − 3√5)/2 ≈ 0.146 — a root of x² − 7x + 1 = 0; its conjugate
// 1/s = (7 + 3√5)/2 ≈ 6.854.
//
// Both A and B have last column = e₄, so [e₄] = [0:0:0:1] is a common
// projective fixed point. Eigenvalue inventory:
//   - A: {1, 1, s, s²}  — dominant eigenvalue 1 has multiplicity 2; not loxodromic.
//   - B: {1, 1, s, 1/s} — dominant eigenvalue 1/s ≈ 6.854 (simple); loxodromic.
// So γ = [B] (single letter) is enough to drive power-iteration.
const S = (7 - 3 * Math.sqrt(5)) / 2;
const SQRT5 = Math.sqrt(5);

const A_PAIR1: Mat4R = [
  [4 * S, 4 * S,     S, 0],
  [2 * S, 3 * S,     S, 0],
  [    S, 2 * S,     S, 0],
  [    8,     3,     2, 1],
];

const B_PAIR1: Mat4R = [
  [ 4,        -4,        1,        0],
  [-2,         3,       -1,        0],
  [ 1,        -2,        1,        0],
  [ SQRT5, 2 * SQRT5, SQRT5,       1],
];

// "Fabi's chart" — affine chart from Fabi Bender's plotLimitSet code.
// Change of basis E with columns
//   e₁ = (1, 0, −1, 0),  e₂ = (0, 1, 0, 0),
//   e₃ = (1, 0,  1, −100),  e₄ = (0, 0, 0, 1).
// E⁻¹ gives denom = (50, 0, 50, 1) and rows = (½, 0, ∓½, 0) etc.,
// scaled by 300 so the tiny limit set is visible.
const FABI_CHART: CustomChart = {
  id: 'fabi',
  label: "Fabi's chart",
  pretty: "Fabi's chart — denom=(50, 0, 50, 1), ×300 display scale",
  denom: [50, 0, 50, 1],
  rowX:  [ 150, 0, -150, 0],
  rowY:  [   0, 300, 0,  0],
  rowZ:  [ 150, 0,  150, 0],
};

export const EXAMPLES: readonly SL4RExample[] = [
  {
    id: 'pair1',
    label: 'pair-1 (s = (7−3√5)/2)',
    description:
      'Two-generator subgroup ⟨A, B⟩ ⊂ GL(4,R). Both fix [e₄]; B is loxodromic ' +
      'with eigenvalues {1, 1, s, 1/s}, so γ = B drives power-iteration to its 1/s-eigenline.',
    generators: [A_PAIR1, B_PAIR1],
    involutions: false,
    gamma:     [2], // code 2 = B (codes are 0=A, 1=A⁻¹, 2=B, 3=B⁻¹)
    gammaName: 'B',
    powerIter: 80,
    customCharts: [FABI_CHART],
  },
];

export function exampleById(id: string): SL4RExample {
  const ex = EXAMPLES.find((e) => e.id === id);
  if (!ex) throw new Error(`unknown sl4r example id: ${id}`);
  return ex;
}
