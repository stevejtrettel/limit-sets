/**
 * Startup sanity checks for the Galois-embedded SL(3) examples.
 *
 *   Structural — both generators have det 1 at t AND at t^σ (so each factor is a
 *                genuine SL(3,ℝ) rep), and t is a unit: t·t^σ = ±1, t + t^σ ∈ ℤ,
 *                which is what puts the group inside SL(3, 𝒪_K).
 *   Dynamical  — the block seed search finds a word proximal in BOTH factors, and
 *                power iteration converges in each (drift → 0). A tied dominant
 *                modulus in one factor would leave the basepoint off the limit set.
 */

import { type GaloisExample } from './catalog.ts';
import { generatorsAt } from './family.ts';
import { seedGalois } from './recipe.ts';
import { matDet } from '../../core/matrix.ts';
import { runValidation } from '../../core/validation.ts';

export interface ValidationResult {
  example: GaloisExample;
  passed: boolean;
  errors: string[];
  warnings: string[];
  seedName: string;
  blockLambdaMax: number[];
  minGap: number;
  drift: number;
}

function structuralCheck(ex: GaloisExample, errors: string[]): void {
  const { t, tSigma, trace, norm } = ex.unit;

  if (Math.abs(t * tSigma - norm) > 1e-9) {
    errors.push(`t·t^σ = ${(t * tSigma).toFixed(12)} ≠ ${norm}; t is not a unit`);
  }
  if (Math.abs(t + tSigma - trace) > 1e-9) {
    errors.push(`t + t^σ = ${(t + tSigma).toFixed(12)} ≠ ${trace}`);
  }
  if (Math.abs(t) < 1e-9 || Math.abs(tSigma) < 1e-9) {
    errors.push('t or t^σ is 0; the generators involve 1/t');
  }

  for (const [place, tt] of [['t', t], ['t^σ', tSigma]] as [string, number][]) {
    generatorsAt(tt).forEach((M, i) => {
      const d = matDet(M);
      if (!Number.isFinite(d) || Math.abs(d - 1) > 1e-9) {
        errors.push(`generator ${i === 0 ? 'A' : 'B'} at ${place} has det = ${d}; expected 1`);
      }
    });
  }
}

export function validateExample(ex: GaloisExample): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  structuralCheck(ex, errors);

  let seedName = '';
  let blockLambdaMax: number[] = [];
  let minGap = NaN;
  let drift = NaN;
  if (errors.length === 0) {
    try {
      const s = seedGalois(ex.unit);
      seedName = s.name;
      blockLambdaMax = s.blockLambdaMax;
      minGap = s.minGap;
      drift = s.drift;
      if (s.fallback) errors.push('no word is loxodromic in both factors');
      if (blockLambdaMax.some((l) => !Number.isFinite(l) || l < 1.001)) {
        errors.push(`a factor is not expanding: |λ| = [${blockLambdaMax.map((l) => l.toFixed(4)).join(', ')}]`);
      }
      if (drift > 1e-6) {
        warnings.push(`power iteration drift = ${drift.toExponential(2)}; basepoint may be off Λ`);
      }
      if (minGap < 1e-3) {
        warnings.push(`weak spectral gap ${minGap.toExponential(2)} in a factor`);
      }
    } catch (e) {
      errors.push(`seeding failed: ${(e as Error).message}`);
    }
  }

  return { example: ex, passed: errors.length === 0, errors, warnings, seedName, blockLambdaMax, minGap, drift };
}

export function validateAllExamples(examples: readonly GaloisExample[]): ValidationResult[] {
  return runValidation('galois-sl3', examples.map(validateExample), {
    idOf: (r) => r.example.id,
    summaryOf: (r) =>
      `γ = ${r.seedName}  |λ| = [${r.blockLambdaMax.map((l) => l.toFixed(3)).join(', ')}]  ` +
      `gap = ${r.minGap.toFixed(4)}  drift = ${r.drift.toExponential(2)}`,
  });
}
