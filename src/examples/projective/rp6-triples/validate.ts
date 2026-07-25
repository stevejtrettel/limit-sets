/**
 * Startup sanity checks for the RP⁶ triple examples.
 *
 *   Structural — every generator is an involution (M² = I) and non-singular.
 *                These live in SL(7,ℝ); involutions with trace −1 have det +1.
 *   Dynamical  — the loxodromic seed search converges (|λ_max| > 1, finite), so
 *                the proximal fixed point lies on the limit set Λ ⊂ RP⁶.
 */

import { type RP6Example, seedRP6 } from './data.ts';
import { type Mat, matDet, matMul, matDim } from '../../../core/matrix.ts';
import { makeMatrixAction, asInvolutions } from '../../../core/matrixAction.ts';
import { runValidation } from '../../../core/validation.ts';

export interface ValidationResult {
  example: RP6Example;
  passed: boolean;
  errors: string[];
  warnings: string[];
  lambdaMax: number;
  drift: number;
  dets: number[];
}

/** ‖M² − I‖∞ — how far a generator is from being an involution. */
function involutionResidual(M: Mat): number {
  const n = matDim(M);
  const M2 = matMul(M, M);
  let r = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const e = M2[i * n + j] - (i === j ? 1 : 0);
      r = Math.max(r, Math.abs(e));
    }
  }
  return r;
}

function structuralCheck(ex: RP6Example, errors: string[]): number[] {
  const dets: number[] = [];
  for (let i = 0; i < ex.generators.length; i++) {
    const d = matDet(ex.generators[i]);
    dets.push(d);
    if (!Number.isFinite(d) || Math.abs(d) < 1e-12) {
      errors.push(`generator ${i} det = ${d}; matrix is singular`);
    }
    const res = involutionResidual(ex.generators[i]);
    if (res > 1e-9) {
      errors.push(`generator ${i} is not an involution (‖M²−I‖∞ = ${res.toExponential(2)})`);
    }
  }
  return dets;
}

export function validateExample(ex: RP6Example): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const dets = structuralCheck(ex, errors);

  let lambdaMax = NaN;
  let drift = NaN;
  if (errors.length === 0) {
    const action = makeMatrixAction(asInvolutions(ex.generators));
    const s = seedRP6(action);
    lambdaMax = s.lambdaMax;
    drift = s.drift;
    if (!Number.isFinite(lambdaMax) || lambdaMax === 0) {
      errors.push(`no loxodromic seed found; |λ_max| = ${lambdaMax}`);
    } else if (lambdaMax < 1.0 + 1e-3) {
      warnings.push(`|λ_max(γ)| = ${lambdaMax.toFixed(4)} ≈ 1; γ may not be loxodromic`);
    }
  }

  return { example: ex, passed: errors.length === 0, errors, warnings, lambdaMax, drift, dets };
}

export function validateAllExamples(examples: readonly RP6Example[]): ValidationResult[] {
  return runValidation('rp6-triples', examples.map(validateExample), {
    idOf: (r) => r.example.id,
    summaryOf: (r) =>
      `λ_max=${r.lambdaMax.toFixed(3)}  drift=${r.drift.toFixed(4)}  dets=[${r.dets.map((d) => d.toFixed(3)).join(', ')}]`,
  });
}
