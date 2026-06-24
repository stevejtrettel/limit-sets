/**
 * Fixed SO(2,1) ⊂ SL(3,ℝ) representation of the once-punctured torus group
 * F₂ = ⟨a, b⟩, supplied DIRECTLY as two 3×3 matrices (no SL(2,ℝ) rep, no sym²
 * lift). Both generators preserve the form Q(α, β, γ) = β² − 4αγ on ℝ³ — the
 * discriminant of the binary quadratic form αx² + βxy + γy².
 *
 *   A = diag(3 + 2√2, 1, 3 − 2√2)   (already in the proximal eigenbasis,
 *                                    λ₊² = 3+2√2 > 1 > λ₋² = 3−2√2)
 *   B = [[2, √2, 1], [2√2, 3, 2√2], [1, √2, 2]]   (same eigenvalues)
 *
 * Both have det = 1 and translation length ℓ = ln(3 + 2√2). The φ-twist
 * character is χ = exp(−φ); with the cohomology defaults (kA = ℓ(a), kB = 0)
 * and scale s, χ_A = exp(−s·ℓ(a)), χ_B = 1; at s = 1, χ_A = 3 − 2√2 exactly.
 *
 * Pure math: no DOM, no three.js, no demo state.
 */

import { type Mat, mat, matMul, matDet } from '../../core/matrix.ts';

export interface SO21Rep {
  A: Mat;
  B: Mat;
}

export interface CohomologyMultipliers {
  kA: number;
  kB: number;
}

const S2 = Math.SQRT2;

/** A = diag(λ₊², 1, λ₋²) with λ₊² = 3 + 2√2; already in the proximal eigenbasis. */
export const REP_A: Mat = mat([
  [3 + 2 * S2, 0, 0],
  [0,          1, 0],
  [0,          0, 3 - 2 * S2],
]);

/** B with eigenvalues (3+2√2, 1, 3−2√2); same translation length as A. */
export const REP_B: Mat = mat([
  [2,       S2, 1],
  [2 * S2,  3,  2 * S2],
  [1,       S2, 2],
]);

export const DEFAULT_REP: SO21Rep = { A: REP_A, B: REP_B };

/** Default multipliers (kA, kB) = (ℓ(a), 0); ℓ(a) = ln(λ₊²) read off A[0][0]. */
export function defaultMultipliers(rep: SO21Rep): CohomologyMultipliers {
  return { kA: Math.log(rep.A[0]), kB: 0 };
}

/** Q(α, β, γ) = β² − 4αγ as a symmetric matrix J (so Q(v) = vᵀ J v). */
const J: Mat = mat([
  [0,  0, -2],
  [0,  1,  0],
  [-2, 0,  0],
]);

function transpose3(m: Mat): Mat {
  return mat([
    [m[0], m[3], m[6]],
    [m[1], m[4], m[7]],
    [m[2], m[5], m[8]],
  ]);
}

/** Sanity-check a genuine SO(2,1) rep: det = 1 and MᵀJM = J (preserves Q). */
export function verifySO21Rep(rep: SO21Rep, tol = 1e-9): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const check = (name: string, M: Mat): void => {
    const d = matDet(M);
    if (Math.abs(d - 1) > tol) reasons.push(`det(${name}) = ${d}, expected 1`);
    const MtJM = matMul(matMul(transpose3(M), J), M);
    let maxErr = 0;
    for (let i = 0; i < 9; i++) maxErr = Math.max(maxErr, Math.abs(MtJM[i] - J[i]));
    if (maxErr > tol) reasons.push(`${name} does not preserve Q = β²−4αγ (max |MᵀJM − J| = ${maxErr})`);
  };
  check('A', rep.A);
  check('B', rep.B);
  return { ok: reasons.length === 0, reasons };
}

// Permanent assertion — runs whenever DEFAULT_REP is imported. Catches any
// future typo that breaks the SO(2,1) conditions before the pipeline runs.
{
  const r = verifySO21Rep(DEFAULT_REP);
  if (!r.ok) {
    throw new Error(`[james-marit/so21Rep] DEFAULT_REP is not a valid SO(2,1) rep:\n${r.reasons.map((x) => `  - ${x}`).join('\n')}`);
  }
}
