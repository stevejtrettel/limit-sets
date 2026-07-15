/**
 * Startup sanity checks for SU(2,1) examples.
 *
 *   Structural — every generator preserves the ball form (g*Jg = J), triangle
 *                reflections are involutions (ι² = id), triangle points are
 *                null and reproduce the requested Cartan invariant.
 *   Dynamical  — the loxodromic seed search succeeds and its basepoint lies
 *                on the null cone (limit sets live on ∂CH²).
 *
 * Failures throw on app startup; warnings just log.
 */

import {
  type CMat, cidentity, cmatAdjoint, cmatMul, cmatSub, cmatMaxAbs,
} from '../../core/complexMatrix.ts';
import { BALL_FORM, cartanInvariant, nullResidual } from './hermitian.ts';
import { idealTriangleReflections } from './recipe.ts';
import { type SU21Example, buildAction, seedSU21, trianglePointsOf } from './examples.ts';
import { runValidation } from '../../core/validation.ts';

export interface ValidationResult {
  example: SU21Example;
  passed: boolean;
  errors: string[];
  warnings: string[];
  lambdaMax: number;
  seedNullResidual: number;
}

/** ‖g*Jg − J‖_max — 0 exactly for U(2,1) matrices. */
export function formError(g: CMat): number {
  return cmatMaxAbs(cmatSub(cmatMul(cmatAdjoint(g), cmatMul(BALL_FORM, g)), BALL_FORM));
}

function structuralCheck(ex: SU21Example, errors: string[]): CMat[] {
  const mats: CMat[] = [];
  const pts = trianglePointsOf(ex);
  if (pts) {
    pts.forEach((p, i) => {
      const r = nullResidual(p);
      if (r > 1e-12) errors.push(`triangle point p${i + 1} off the null cone (residual ${r.toExponential(2)})`);
    });
    if (ex.cartanA !== undefined) {
      const A = cartanInvariant(...pts);
      if (Math.abs(A - ex.cartanA) > 1e-10) {
        errors.push(`Cartan invariant ${A.toFixed(12)} ≠ requested ${ex.cartanA.toFixed(12)}`);
      }
    }
    const refl = idealTriangleReflections(...pts);
    refl.forEach((m, i) => {
      const sq = cmatSub(cmatMul(m, m), cidentity(3));
      const err = cmatMaxAbs(sq);
      if (err > 1e-10) errors.push(`ι${i + 1}² ≠ id (err ${err.toExponential(2)})`);
    });
    mats.push(...refl);
  }
  if (ex.generators) mats.push(...ex.generators.map((g) => g.M));
  mats.forEach((m, i) => {
    const err = formError(m);
    if (err > 1e-9) {
      errors.push(`generator ${i} does not preserve the ball form (‖g*Jg−J‖ = ${err.toExponential(2)})`);
    }
  });
  return mats;
}

export function validateExample(ex: SU21Example): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  structuralCheck(ex, errors);

  let lambdaMax = NaN;
  let seedNullResidual = NaN;
  if (errors.length === 0) {
    const action = buildAction(ex);
    try {
      const s = seedSU21(ex, action);
      lambdaMax = s.lambdaMax;
      seedNullResidual = nullResidual(s.basepoint);
      if (!Number.isFinite(lambdaMax) || lambdaMax <= 1) {
        errors.push(`no certified loxodromic seed found; |λ_max| = ${lambdaMax}`);
      }
      // Attracting fixed points of loxodromics lie on ∂CH² — the null cone.
      if (seedNullResidual > 1e-6) {
        errors.push(`seed basepoint off the null cone (|⟨z,z⟩|/|z|² = ${seedNullResidual.toExponential(2)})`);
      }
    } catch (e) {
      errors.push(`seeding failed: ${String(e)}`);
    }
  }

  return {
    example: ex,
    passed: errors.length === 0,
    errors,
    warnings,
    lambdaMax,
    seedNullResidual,
  };
}

export function validateAllExamples(
  examples: readonly SU21Example[],
): ValidationResult[] {
  return runValidation('su21', examples.map(validateExample), {
    idOf: (r) => r.example.id,
    summaryOf: (r) =>
      `λ_max=${r.lambdaMax.toFixed(3)}  null-residual=${r.seedNullResidual.toExponential(1)}`,
  });
}
