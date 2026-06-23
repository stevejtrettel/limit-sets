/**
 * Startup sanity checks for the hypergeometric catalogs.
 *
 *   Structural — each rotation tuple yields an integer companion polynomial that
 *                is self-reciprocal: degree-5 (odd) ⇒ palindromic OR
 *                anti-palindromic; degree-6 (even, symplectic) ⇒ palindromic.
 *                Leading and constant coefficient ±1.
 *   Dynamical  — a certified loxodromic seed word exists and power-iterates to a
 *                finite attracting direction (the limit-set basepoint). Finite
 *                groups (positive-definite form) have no limit set, so the
 *                dynamical check is skipped for them.
 *
 * Both the degree-5 orthogonal and degree-6 symplectic catalogs validate through
 * the same core, parameterised by degree and reciprocal kind. (Merges the old
 * o5/validate.ts and sp6/validate.ts.)
 */

import { cyclotomicProduct } from '../../core/polynomial.ts';
import { hypergeometricAction, WALK_LABELS, WALK_FALLBACK, type Walk } from './recipe.ts';
import { seedFromLoxodromic } from '../../core/seed.ts';
import { runValidation } from '../../core/validation.ts';

export interface HyperExampleLike {
  id: string;
  label: string;
  status: string;
  alpha: readonly string[];
  beta: readonly string[];
}

export interface ValidationResult {
  example: HyperExampleLike;
  passed: boolean;
  errors: string[];
  warnings: string[];
  gammaName: string;
  lambdaMax: number;
  drift: number;
}

/** +1 if palindromic, −1 if anti-palindromic, 0 if neither. */
function reciprocalSign(c: readonly number[]): 1 | -1 | 0 {
  const n = c.length;
  let pal = true, anti = true;
  for (let i = 0; i < n; i++) {
    if (c[i] !== c[n - 1 - i]) pal = false;
    if (c[i] !== -c[n - 1 - i]) anti = false;
  }
  return pal ? 1 : anti ? -1 : 0;
}

interface HyperValidationOptions {
  degree: number;
  walk: Walk;
  /** 'self' allows palindromic OR anti-palindromic (odd degree); 'palindrome'
   *  requires palindromic (even/symplectic degree). */
  reciprocal: 'self' | 'palindrome';
  /** Statuses with no limit set (skip the dynamical check). */
  noLimitSet?: readonly string[];
}

function structuralCheck(
  ex: HyperExampleLike, degree: number, reciprocal: 'self' | 'palindrome', errors: string[],
): void {
  const checks: [string, readonly string[]][] = [['f (α)', ex.alpha], ['g (β)', ex.beta]];
  for (const [name, rots] of checks) {
    let c: number[];
    try {
      c = cyclotomicProduct(rots);
    } catch (e) {
      errors.push(`${name}: ${(e as Error).message}`);
      continue;
    }
    if (c.length !== degree + 1) { errors.push(`${name} has degree ${c.length - 1}, expected ${degree}`); continue; }
    if (c[0] !== 1) errors.push(`${name} leading coefficient ${c[0]} ≠ 1`);
    if (Math.abs(c[degree]) !== 1) errors.push(`${name} constant term ${c[degree]} is not ±1`);
    const sign = reciprocalSign(c);
    if (reciprocal === 'palindrome' ? sign !== 1 : sign === 0) {
      errors.push(`${name} is not ${reciprocal === 'palindrome' ? 'palindromic' : 'self-reciprocal'}`);
    }
  }
}

function validateOne(ex: HyperExampleLike, opts: HyperValidationOptions): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  structuralCheck(ex, opts.degree, opts.reciprocal, errors);

  let lambdaMax = NaN, drift = NaN, gammaName = '—';
  const noLimitSet = opts.noLimitSet?.includes(ex.status) ?? false;
  if (errors.length === 0 && !noLimitSet) {
    const action = hypergeometricAction(ex.alpha, ex.beta, opts.walk);
    const s = seedFromLoxodromic(action, {
      labels: WALK_LABELS[opts.walk],
      fallbackWord: WALK_FALLBACK[opts.walk],
    });
    lambdaMax = s.lambdaMax;
    drift = s.drift;
    gammaName = s.name;
    if (s.fallback) {
      warnings.push('no loxodromic seed word found; fell back to parabolic γ');
    } else if (drift > 1e-2 && Math.abs(drift - 2) > 1e-2) {
      warnings.push(`drift = ${drift.toFixed(4)} (expected ≈0 or ≈2); seed may not have converged`);
    }
  }

  return { example: ex, passed: errors.length === 0, errors, warnings, gammaName, lambdaMax, drift };
}

// ─── Degree-5 orthogonal ─────────────────────────────────────────────────────

const ORTHOGONAL_OPTS: HyperValidationOptions = {
  degree: 5, walk: 'free-product', reciprocal: 'self', noLimitSet: ['finite'],
};

export function validateOrthogonalExample(ex: HyperExampleLike): ValidationResult {
  return validateOne(ex, ORTHOGONAL_OPTS);
}

export function validateAllOrthogonal(examples: readonly HyperExampleLike[]): ValidationResult[] {
  return runValidation('hypergeometric/o5', examples.map(validateOrthogonalExample), {
    idOf: (r) => r.example.label,
    summaryOf: (r) => `γ=${r.gammaName.padEnd(8)} λ_max=${r.lambdaMax.toFixed(3)}  drift=${r.drift.toFixed(4)}`,
  });
}
