/**
 * Startup sanity checks for GL(4,R) examples.
 *
 *   Structural — every generator matrix is non-singular (det ≠ 0).
 *
 *   Dynamical  — power iteration of γ converges (|λ_max| > 1, finite) so the
 *                proximal fixed point lies on the limit set Λ ⊂ RP³, not at
 *                the seed.
 *
 * Unlike sp6 (where matrices are integer & symplectic so |det|=1 exactly) and
 * sl3r (where SL(3,R) gives |det|=1), our sl4r examples can be in plain
 * GL(4,R) — projectively only invertibility matters. We log det for
 * inspection but only fail on det = 0.
 */

import { type SL4RExample } from './types.ts';
import { makeMat4Action, mat4Det } from './action.ts';
import { computeProximalBasepoint } from '../core/orbit.ts';
import { runValidation } from '../core/validation.ts';

export interface ValidationResult {
  example: SL4RExample;
  passed: boolean;
  errors: string[];
  warnings: string[];
  lambdaMax: number;
  drift: number;
  dets: number[];
}

function structuralCheck(
  ex: SL4RExample,
  errors: string[],
  warnings: string[],
): number[] {
  const dets: number[] = [];
  for (let i = 0; i < ex.generators.length; i++) {
    const d = mat4Det(ex.generators[i]);
    dets.push(d);
    if (!Number.isFinite(d) || Math.abs(d) < 1e-12) {
      errors.push(`generator ${i} det = ${d}; matrix is singular`);
    }
    if (ex.involutions) {
      // For 4×4 involutions both ±1 trace patterns are possible; just check
      // det = ±1 here, leave the eigenvalue audit to power iteration.
      if (Math.abs(Math.abs(d) - 1) > 1e-6) {
        warnings.push(`generator ${i} involution det = ${d.toFixed(6)}; expected ±1`);
      }
    }
  }
  return dets;
}

export function validateExample(ex: SL4RExample): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const dets = structuralCheck(ex, errors, warnings);

  let lambdaMax = NaN;
  let drift = NaN;
  if (errors.length === 0) {
    const action = makeMat4Action(ex.generators, { involutions: ex.involutions });
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
    lambdaMax, drift, dets,
  };
}

export function validateAllExamples(
  examples: readonly SL4RExample[],
): ValidationResult[] {
  return runValidation('sl4r', examples.map(validateExample), {
    idOf: (r) => r.example.id,
    summaryOf: (r) =>
      `λ_max=${r.lambdaMax.toFixed(3)}  drift=${r.drift.toFixed(4)}  dets=[${r.dets.map((d) => d.toFixed(4)).join(', ')}]`,
  });
}
