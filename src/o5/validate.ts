/**
 * Startup sanity checks for the O(5) dataset.
 *
 *   Structural — each coefficient list is length 6, integer, with leading
 *                coefficient 1, and SELF-RECIPROCAL: x⁵f(1/x) = ±f(x), i.e. the
 *                reversed coefficient list equals ±the original. (Degree 5 is
 *                odd, so these are palindromic OR anti-palindromic — NOT plain
 *                palindromic like the symplectic degree-6 sp6 case.)
 *   Dynamical  — power iteration on γ = TB converges (small drift) to a finite
 *                attracting direction. TB is parabolic in the (near-)maximally-
 *                unipotent cases, so |λ_max| ≈ 1 is expected and not an error.
 *
 * Failures throw; soft anomalies (non-converged drift) are warnings.
 */

import type { O5Example } from './types.ts';
import { makeO5Action } from './action.ts';
import { loxodromicSeed } from './seed.ts';
import { runValidation } from '../core/validation.ts';

export interface ValidationResult {
  example: O5Example;
  passed: boolean;
  errors: string[];
  warnings: string[];
  /** Name of the loxodromic seed word found (e.g. "B²T"), or "TB" on fallback. */
  gammaName: string;
  lambdaMax: number;
  drift: number;
}

function reciprocalSign(c: readonly number[]): 1 | -1 | 0 {
  // +1 if palindromic, −1 if anti-palindromic, 0 if neither.
  const n = c.length;
  let pal = true, anti = true;
  for (let i = 0; i < n; i++) {
    if (c[i] !== c[n - 1 - i]) pal = false;
    if (c[i] !== -c[n - 1 - i]) anti = false;
  }
  return pal ? 1 : anti ? -1 : 0;
}

function structuralCheck(ex: O5Example, errors: string[]): void {
  const checks: [string, readonly number[]][] = [
    ['coefflistf', ex.coefflistf],
    ['coefflistg', ex.coefflistg],
  ];
  for (const [name, c] of checks) {
    if (c.length !== 6) { errors.push(`${name} has length ${c.length}, expected 6`); continue; }
    if (c[0] !== 1) errors.push(`${name}[0] = ${c[0]}, expected 1`);
    if (Math.abs(c[5]) !== 1) errors.push(`${name} constant term ${c[5]} is not ±1`);
    for (let i = 0; i < 6; i++) {
      if (!Number.isInteger(c[i])) errors.push(`${name}[${i}] = ${c[i]} is not integer`);
    }
    if (reciprocalSign(c) === 0) errors.push(`${name} is not self-reciprocal (x⁵f(1/x) ≠ ±f(x))`);
  }
}

export function validateExample(ex: O5Example): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  structuralCheck(ex, errors);

  let lambdaMax = NaN, drift = NaN, gammaName = '—';
  // Finite groups (positive-definite form) have no limit set, hence no
  // loxodromic seed — that's expected, not a failure. Only validate structure.
  if (errors.length === 0 && ex.status !== 'finite') {
    const action = makeO5Action(ex.coefflistf, ex.coefflistg);
    const s = loxodromicSeed(action);
    lambdaMax = s.lambdaMax;
    drift = s.drift;
    gammaName = s.name;
    if (s.fallback) {
      warnings.push('no loxodromic seed word found; fell back to parabolic γ = TB');
    } else if (drift > 1e-2 && Math.abs(drift - 2) > 1e-2) {
      warnings.push(`drift = ${drift.toFixed(4)} (expected ≈0 or ≈2); seed may not have converged`);
    }
  }

  return { example: ex, passed: errors.length === 0, errors, warnings, gammaName, lambdaMax, drift };
}

export function validateAllExamples(examples: readonly O5Example[]): ValidationResult[] {
  return runValidation('o5', examples.map(validateExample), {
    idOf: (r) => r.example.label,
    summaryOf: (r) => `γ=${r.gammaName.padEnd(8)} λ_max=${r.lambdaMax.toFixed(3)}  drift=${r.drift.toFixed(4)}`,
  });
}
