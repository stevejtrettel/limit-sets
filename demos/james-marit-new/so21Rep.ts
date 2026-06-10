/**
 * Fixed SO(2,1) ⊂ SL(3, R) representation of the once-punctured torus group
 * F₂ = ⟨a, b⟩, supplied DIRECTLY as two 3×3 matrices — no SL(2,R) rep and no
 * sym² lift. (The original james-marit demo built these by lifting a 2×2
 * Fuchsian rep through sym²; here we skip that and hard-code the result.)
 *
 * The two generators preserve the SO(2,1) form Q(α, β, γ) = β² − 4αγ on R³ —
 * the DISCRIMINANT of the binary quadratic form αx² + βxy + γy². (This is the
 * "coefficients of a binary quadratic form" model of sym² : SL(2,R) → SO(2,1);
 * it preserves the discriminant rather than the β²−αγ form of the (x²,xy,y²)
 * vector model. Both are equivalent realisations of SO(2,1) ⊂ SL(3,R).)
 *
 *   A = diag(3 + 2√2,  1,  3 − 2√2)         (already in eigenbasis, ordered
 *                                            λ₊² = 3+2√2 > 1 > λ₋² = 3−2√2)
 *
 *   B = [[ 2,    √2,   1   ],
 *        [ 2√2,  3,    2√2 ],
 *        [ 1,    √2,   2   ]]               (eigenvalues 3+2√2, 1, 3−2√2 too)
 *
 * Both have det = 1 and translation length ℓ = ln(3 + 2√2). The φ-twist
 * character used in the 4×4 block construction is χ = exp(−φ): with the
 * cohomology defaults (kA = ℓ(a), kB = 0) and scale s, χ_A = exp(−s·ℓ(a))
 * and χ_B = 1; at s = 1 this gives χ_A = 3 − 2√2 exactly.
 *
 * This file is pure math: no DOM, no Three.js, no demo state.
 */

import type { Mat3R } from './symSquare';
import { det3, mul3 } from './symSquare';

export interface SO21Rep {
  A: Mat3R;
  B: Mat3R;
}

export interface CohomologyMultipliers {
  kA: number;
  kB: number;
}

const S2 = Math.SQRT2; // √2

/** A = diag(λ₊², 1, λ₋²) with λ₊² = 3 + 2√2; already in the proximal eigenbasis. */
export const REP_A: Mat3R = [
  [3 + 2 * S2, 0, 0],
  [0,          1, 0],
  [0,          0, 3 - 2 * S2],
];

/** B with eigenvalues (3+2√2, 1, 3−2√2); same translation length as A. */
export const REP_B: Mat3R = [
  [2,       S2, 1],
  [2 * S2,  3,  2 * S2],
  [1,       S2, 2],
];

export const DEFAULT_REP: SO21Rep = { A: REP_A, B: REP_B };

/**
 * Default cohomology multipliers for this rep: (kA, kB) = (ℓ(a), 0), where
 * ℓ(a) = ln(λ₊²) is read straight off A's (0,0) entry (A is diagonal with the
 * leading eigenvalue λ₊² there). φ(g) = s · k_g then twists the 3×3 block by
 * exp(−φ(g)); at s = 1, exp(−φ(a)) = 1/(3+2√2) = 3−2√2 = the screenshot's χ.
 */
export function defaultMultipliers(rep: SO21Rep): CohomologyMultipliers {
  return { kA: Math.log(rep.A[0][0]), kB: 0 };
}

/** Matrix transpose (3×3). */
function transpose3(m: Mat3R): Mat3R {
  return [
    [m[0][0], m[1][0], m[2][0]],
    [m[0][1], m[1][1], m[2][1]],
    [m[0][2], m[1][2], m[2][2]],
  ];
}

// SO(2,1) form Q(α, β, γ) = β² − 4αγ (the binary-quadratic-form discriminant)
// as a symmetric matrix J, so Q(v) = vᵀ J v.
const J: Mat3R = [
  [0,  0, -2],
  [0,  1,  0],
  [-2, 0,  0],
];

/**
 * Sanity-check that `rep` is a genuine SO(2,1) representation: both generators
 * have det = 1 and preserve the form Q (MᵀJM = J). Returns `{ ok, reasons }`;
 * `reasons` lists every failing condition with its numerical drift.
 */
export function verifySO21Rep(
  rep: SO21Rep, tol = 1e-9,
): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const check = (name: string, M: Mat3R): void => {
    const d = det3(M);
    if (Math.abs(d - 1) > tol) reasons.push(`det(${name}) = ${d}, expected 1`);
    // MᵀJM should equal J (M preserves Q).
    const MtJM = mul3(mul3(transpose3(M), J), M);
    let maxErr = 0;
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        maxErr = Math.max(maxErr, Math.abs(MtJM[i][j] - J[i][j]));
      }
    }
    if (maxErr > tol) reasons.push(`${name} does not preserve Q = β²−4αγ (max |MᵀJM − J| = ${maxErr})`);
  };
  check('A', rep.A);
  check('B', rep.B);
  return { ok: reasons.length === 0, reasons };
}

// Permanent assertion — runs whenever DEFAULT_REP is imported. Catches any
// future typo in the matrices that breaks the SO(2,1) conditions before the
// demo's pipeline can produce garbage.
{
  const r = verifySO21Rep(DEFAULT_REP);
  if (!r.ok) {
    const lines = r.reasons.map((x) => `  - ${x}`).join('\n');
    throw new Error(`[so21Rep] DEFAULT_REP is not a valid SO(2,1) rep:\n${lines}`);
  }
}
