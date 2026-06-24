/**
 * Startup sanity checks for the convex-projective RP² catalog.
 *
 *   Structural — every generator has |det| ≈ 1. For involution groups, also
 *                check |trace| ≈ 1 and M² ≈ I (a non-trivial 3×3 involution has
 *                eigenvalues 1,1,−1 or 1,−1,−1).
 *   Dynamical  — power iteration of γ converges (|λ_max| > 1, finite), so the
 *                proximal fixed point lies on the limit set Λ ⊂ RP².
 *
 * (Migrated from src/sl3r/validate.ts; the hand-rolled mat3 helpers are gone —
 * structural checks now use the generic core/matrix routines.)
 */

import { type MatrixGroupExample, seedTriangle } from './data.ts';
import { matDet, matTrace, matMul, identity, type Mat } from '../../../core/matrix.ts';
import { makeMatrixAction, asInvolutions, pairWithInverses } from '../../../core/matrixAction.ts';
import { runValidation } from '../../../core/validation.ts';

export interface ValidationResult {
  example: MatrixGroupExample;
  passed: boolean;
  errors: string[];
  warnings: string[];
  lambdaMax: number;
  drift: number;
}

function maxDevFromIdentity(M: Mat): number {
  const I = identity(3);
  let maxDev = 0;
  for (let i = 0; i < M.length; i++) maxDev = Math.max(maxDev, Math.abs(M[i] - I[i]));
  return maxDev;
}

function structuralCheck(ex: MatrixGroupExample, errors: string[], warnings: string[]): void {
  for (let i = 0; i < ex.generators.length; i++) {
    const M = ex.generators[i];
    const det = matDet(M);
    if (Math.abs(Math.abs(det) - 1) > 1e-6) {
      errors.push(`generator ${i} has det ${det.toFixed(6)}; |det| should be 1`);
    }
    if (ex.involutions) {
      const tr = matTrace(M);
      if (Math.abs(Math.abs(tr) - 1) > 1e-4) {
        warnings.push(`generator ${i} trace = ${tr.toFixed(4)}; expected ±1 for a non-trivial involution`);
      }
      const dev = maxDevFromIdentity(matMul(M, M));
      if (dev > 1e-4) {
        warnings.push(`generator ${i}: M² ≠ I (max entry deviation ${dev.toExponential(2)})`);
      }
    }
  }
}

export function validateExample(ex: MatrixGroupExample): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  structuralCheck(ex, errors, warnings);

  let lambdaMax = NaN;
  let drift = NaN;
  if (errors.length === 0) {
    const action = makeMatrixAction(
      ex.involutions ? asInvolutions(ex.generators) : pairWithInverses(ex.generators));
    const s = seedTriangle(action);
    lambdaMax = s.lambdaMax;
    drift = s.drift;
    if (!Number.isFinite(lambdaMax) || lambdaMax === 0) {
      errors.push(`no loxodromic seed found; |λ_max| = ${lambdaMax}`);
    } else if (lambdaMax < 1.0 + 1e-3) {
      warnings.push(`|λ_max(γ)| = ${lambdaMax.toFixed(4)} ≈ 1; group may be non-discrete`);
    }
  }

  return { example: ex, passed: errors.length === 0, errors, warnings, lambdaMax, drift };
}

export function validateAllExamples(examples: readonly MatrixGroupExample[]): ValidationResult[] {
  return runValidation('triangle-groups', examples.map(validateExample), {
    idOf: (r) => r.example.id,
    summaryOf: (r) => `λ_max=${r.lambdaMax.toFixed(3)}  drift=${r.drift.toFixed(4)}`,
  });
}
