/**
 * Startup sanity checks for the RP³ pair examples.
 *
 *   Structural — every generator is non-singular (det ≠ 0). These live in plain
 *                GL(4,ℝ), so |det| need not be 1 (unlike the integer symplectic /
 *                orthogonal families); det values are logged for inspection.
 *   Dynamical  — power iteration of γ converges (|λ_max| > 1, finite), so the
 *                proximal fixed point lies on the limit set Λ ⊂ RP³.
 *
 * (Migrated from src/sl4r/validate.ts; structural checks now use core matDet.)
 */

import { type RP3Example, seedRP3 } from './data.ts';
import { matDet } from '../../../core/matrix.ts';
import { makeMatrixAction, asInvolutions, pairWithInverses } from '../../../core/matrixAction.ts';
import { runValidation } from '../../../core/validation.ts';

export interface ValidationResult {
  example: RP3Example;
  passed: boolean;
  errors: string[];
  warnings: string[];
  lambdaMax: number;
  drift: number;
  dets: number[];
}

function structuralCheck(ex: RP3Example, errors: string[], warnings: string[]): number[] {
  const dets: number[] = [];
  for (let i = 0; i < ex.generators.length; i++) {
    const d = matDet(ex.generators[i]);
    dets.push(d);
    if (!Number.isFinite(d) || Math.abs(d) < 1e-12) {
      errors.push(`generator ${i} det = ${d}; matrix is singular`);
    }
    if (ex.involutions && Math.abs(Math.abs(d) - 1) > 1e-6) {
      warnings.push(`generator ${i} involution det = ${d.toFixed(6)}; expected ±1`);
    }
  }
  return dets;
}

export function validateExample(ex: RP3Example): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const dets = structuralCheck(ex, errors, warnings);

  let lambdaMax = NaN;
  let drift = NaN;
  if (errors.length === 0) {
    const action = makeMatrixAction(
      ex.involutions ? asInvolutions(ex.generators) : pairWithInverses(ex.generators));
    const s = seedRP3(action);
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

export function validateAllExamples(examples: readonly RP3Example[]): ValidationResult[] {
  return runValidation('rp3-pairs', examples.map(validateExample), {
    idOf: (r) => r.example.id,
    summaryOf: (r) =>
      `λ_max=${r.lambdaMax.toFixed(3)}  drift=${r.drift.toFixed(4)}  dets=[${r.dets.map((d) => d.toFixed(4)).join(', ')}]`,
  });
}
