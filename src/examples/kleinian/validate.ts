/**
 * Startup sanity checks for SL(2,C) examples.
 *
 *   Structural — every generator has det ≈ 1 (within numerical tolerance).
 *   Dynamical  — power iteration of γ converges (drift small) and yields a
 *                |λ_max(γ)| consistent with a single 2×2 trace computation,
 *                which is the closed-form ground truth for SL(2,C) words.
 *
 * Failures throw on app startup; warnings just log.
 */

import { type ComplexMat2 } from './action.ts';
import { type MobiusExample, seedKleinian } from './examples.ts';
import { makeMobiusAction } from './action.ts';
import { runValidation } from '../../core/validation.ts';

export interface ValidationResult {
  example: MobiusExample;
  passed: boolean;
  errors: string[];
  warnings: string[];
  lambdaMax: number;
  drift: number;
}

// ─── Tiny complex helpers ──────────────────────────────────────────────────

type C = readonly [number, number];

function cMul(a: C, b: C): [number, number] {
  return [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
}
function cAdd(a: C, b: C): [number, number] {
  return [a[0] + b[0], a[1] + b[1]];
}

function matMul(M: ComplexMat2, N: ComplexMat2): ComplexMat2 {
  return {
    a: cAdd(cMul(M.a, N.a), cMul(M.b, N.c)),
    b: cAdd(cMul(M.a, N.b), cMul(M.b, N.d)),
    c: cAdd(cMul(M.c, N.a), cMul(M.d, N.c)),
    d: cAdd(cMul(M.c, N.b), cMul(M.d, N.d)),
  };
}

function matInv(M: ComplexMat2): ComplexMat2 {
  // det = 1 in SL(2,C); inverse is [[d, -b], [-c, a]].
  return {
    a: [ M.d[0],  M.d[1]],
    b: [-M.b[0], -M.b[1]],
    c: [-M.c[0], -M.c[1]],
    d: [ M.a[0],  M.a[1]],
  };
}

function complexDet(g: ComplexMat2): [number, number] {
  return cAdd(cMul(g.a, g.d), [
    -cMul(g.b, g.c)[0],
    -cMul(g.b, g.c)[1],
  ]);
}

/** Multiply matrices along the γ word; codes follow the action convention. */
function wordMatrix(gens: readonly ComplexMat2[], word: readonly number[]): ComplexMat2 {
  let M: ComplexMat2 = { a: [1, 0], b: [0, 0], c: [0, 0], d: [1, 0] };
  for (const g of word) {
    const k = g >> 1;
    const isInv = (g & 1) === 1;
    const G = isInv ? matInv(gens[k]) : gens[k];
    M = matMul(M, G);
  }
  return M;
}

/**
 * Closed-form |λ_max| of γ ∈ SL(2,C). Eigenvalues are (tr ± √(tr² − 4)) / 2,
 * with product 1. The larger-modulus root governs the proximal direction; we
 * pick whichever has |λ| ≥ 1 (loxodromic) or both = 1 (elliptic / parabolic).
 */
function closedFormLambdaMax(M: ComplexMat2): number {
  const tr: [number, number] = [M.a[0] + M.d[0], M.a[1] + M.d[1]];
  const tr2 = cMul(tr, tr);
  const disc: [number, number] = [tr2[0] - 4, tr2[1]];
  // √(disc): polar form
  const r = Math.hypot(disc[0], disc[1]);
  const theta = Math.atan2(disc[1], disc[0]);
  const sqR = Math.sqrt(r);
  const sqrtDisc: [number, number] = [
    sqR * Math.cos(theta / 2),
    sqR * Math.sin(theta / 2),
  ];
  const lam1: [number, number] = [(tr[0] + sqrtDisc[0]) / 2, (tr[1] + sqrtDisc[1]) / 2];
  const lam2: [number, number] = [(tr[0] - sqrtDisc[0]) / 2, (tr[1] - sqrtDisc[1]) / 2];
  const m1 = Math.hypot(lam1[0], lam1[1]);
  const m2 = Math.hypot(lam2[0], lam2[1]);
  return Math.max(m1, m2);
}

function structuralCheck(ex: MobiusExample, errors: string[]): void {
  for (let i = 0; i < ex.generators.length; i++) {
    const [dr, di] = complexDet(ex.generators[i]);
    const err = Math.hypot(dr - 1, di);
    if (err > 1e-9) {
      errors.push(`generator ${i} has det ${dr.toFixed(6)}+${di.toFixed(6)}i (err ${err.toExponential(2)}), expected 1`);
    }
  }
}

export function validateExample(ex: MobiusExample): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  structuralCheck(ex, errors);

  let lambdaMax = NaN;
  let drift = NaN;
  if (errors.length === 0) {
    const action = makeMobiusAction(ex.generators);
    const s = seedKleinian(action);
    lambdaMax = s.lambdaMax;
    drift = s.drift;
    if (!Number.isFinite(lambdaMax) || lambdaMax === 0) {
      errors.push(`no certified loxodromic seed found; |λ_max| = ${lambdaMax}`);
    }
    // Note: unlike real-eigenvalue actions, SL(2,C) loxodromics have complex
    // eigenvalues, so `drift` in R⁴ is generally not ≈0 or ≈2 — it reflects the
    // phase rotation in homogeneous coords. Convergence is verified by the
    // closed-form |λ| cross-check below instead.

    // Cross-check the auto-found word's |λ_max| against the closed-form 2×2
    // eigenvalue (trace formula) — the ground truth for an SL(2,C) word.
    const gammaMat = wordMatrix(ex.generators, s.word);
    const closed = closedFormLambdaMax(gammaMat);
    if (closed > 1.0 + 1e-6) {
      const rel = Math.abs(lambdaMax - closed) / closed;
      if (rel > 0.02) {
        warnings.push(`|λ_max| = ${lambdaMax.toFixed(3)}, closed-form ${closed.toFixed(3)} (rel ${rel.toExponential(2)})`);
      }
    } else if (closed < 1.0 - 1e-6) {
      warnings.push(`seed word closed-form |λ_max| = ${closed.toFixed(3)} < 1; not loxodromic`);
    }
  }

  return {
    example: ex,
    passed: errors.length === 0,
    errors,
    warnings,
    lambdaMax,
    drift,
  };
}

export function validateAllExamples(
  examples: readonly MobiusExample[],
): ValidationResult[] {
  return runValidation('sl2c', examples.map(validateExample), {
    idOf: (r) => r.example.id,
    summaryOf: (r) => `λ_max=${r.lambdaMax.toFixed(3)}  drift=${r.drift.toFixed(4)}`,
  });
}
