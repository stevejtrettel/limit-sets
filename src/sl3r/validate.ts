/**
 * Startup sanity checks for SL(3,R) / PGL(3,R) examples.
 *
 *   Structural — every generator matrix has |det| ≈ 1. For involution groups,
 *                also check trace = 1 and M² ≈ I (a 3D reflection has
 *                eigenvalues 1, 1, -1).
 *
 *   Dynamical  — power iteration of γ converges (|λ_max| > 1, finite) so the
 *                proximal fixed point lies on the limit set Λ ⊂ RP², not at
 *                the basepoint seed. This is the "endpoint of a loxodromic
 *                word" the user mentioned.
 */

import { type SL3RExample } from './examples.ts';
import { makeMat3Action, mat3Det, type Mat3R } from './action.ts';
import { computeProximalBasepoint } from '../core/orbit.ts';

export interface ValidationResult {
  example: SL3RExample;
  passed: boolean;
  errors: string[];
  warnings: string[];
  lambdaMax: number;
  drift: number;
}

function mat3Mul(M: Mat3R, N: Mat3R): Mat3R {
  const out: number[][] = [[0,0,0],[0,0,0],[0,0,0]];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    let s = 0;
    for (let k = 0; k < 3; k++) s += M[r][k] * N[k][c];
    out[r][c] = s;
  }
  return out as unknown as Mat3R;
}

function structuralCheck(ex: SL3RExample, errors: string[], warnings: string[]): void {
  for (let i = 0; i < ex.generators.length; i++) {
    const M = ex.generators[i];
    const det = mat3Det(M);
    if (Math.abs(Math.abs(det) - 1) > 1e-6) {
      errors.push(`generator ${i} has det ${det.toFixed(6)}; |det| should be 1`);
    }
    if (ex.involutions) {
      // Non-trivial 3×3 involutions have eigenvalues either
      //   1, 1, -1  (hyperplane reflection — trace +1, det -1) or
      //   1, -1, -1 (point involution     — trace -1, det +1).
      // Trace ±3 would be the identity / -identity (excluded by M² = I plus
      // det ≠ 0). So |trace| ≈ 1 is the right check.
      const tr = M[0][0] + M[1][1] + M[2][2];
      if (Math.abs(Math.abs(tr) - 1) > 1e-4) {
        warnings.push(`generator ${i} trace = ${tr.toFixed(4)}; expected ±1 for a non-trivial involution`);
      }
      const M2 = mat3Mul(M, M);
      let maxDev = 0;
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
        const expected = r === c ? 1 : 0;
        const dev = Math.abs(M2[r][c] - expected);
        if (dev > maxDev) maxDev = dev;
      }
      if (maxDev > 1e-4) {
        warnings.push(`generator ${i}: M² ≠ I (max entry deviation ${maxDev.toExponential(2)})`);
      }
    }
  }
}

export function validateExample(ex: SL3RExample): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  structuralCheck(ex, errors, warnings);

  let lambdaMax = NaN;
  let drift = NaN;
  if (errors.length === 0) {
    const action = makeMat3Action(ex.generators, { involutions: ex.involutions });
    const r = computeProximalBasepoint(action, ex.gamma, ex.powerIter);
    lambdaMax = r.lambdaMax;
    drift = r.drift;
    if (!Number.isFinite(lambdaMax) || lambdaMax === 0) {
      errors.push(`power iteration produced |λ_max| = ${lambdaMax}; γ may be wrong`);
    } else if (lambdaMax < 1.0 + 1e-3) {
      warnings.push(`|λ_max(γ)| = ${lambdaMax.toFixed(4)} ≈ 1; γ may not be loxodromic`);
    }
  }

  return {
    example: ex,
    passed: errors.length === 0,
    errors, warnings,
    lambdaMax, drift,
  };
}

export function validateAllExamples(
  examples: readonly SL3RExample[],
): ValidationResult[] {
  const results = examples.map(validateExample);
  const failed = results.filter((r) => !r.passed);
  if (failed.length > 0) {
    console.error(`[sl3r] ${failed.length} example(s) failed validation:`);
    for (const r of failed) {
      console.error(`  ${r.example.id}: ${r.errors.join('; ')}`);
    }
    throw new Error('sl3r example validation failed');
  }
  console.log('[sl3r] example validation:');
  for (const r of results) {
    const summary = `λ_max=${r.lambdaMax.toFixed(3)}  drift=${r.drift.toFixed(4)}`;
    const warns = r.warnings.length > 0 ? `  ⚠ ${r.warnings.join('; ')}` : '';
    console.log(`         ${r.example.id.padEnd(16)}  ${summary}${warns}`);
  }
  return results;
}
