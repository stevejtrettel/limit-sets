/**
 * Schwartz–Pappus matrices for the index-2 subgroup Z/3 ∗ Z/3 ⊂ Z/2 ∗ Z/3
 * of the modular group, acting on RP².
 *
 * Two families of generators:
 *   pappusGenerators(c, d)     — Pappus rep on the boundary of the Barbot
 *                                component, parametrised by (c, d) ∈ (-1, 1)².
 *                                Source: Schwartz, "On Pappus and Anosov
 *                                Representations of the Modular Group" §4.2.
 *   anosovGenerators(c, d, a, b) — Anosov interior, parametrised by adding
 *                                a BLV morphing matrix Σ(a, b). r₁ is fixed;
 *                                r₂ becomes Σ⁻¹ · r₂ · Σ. At (a, b) = (1, 1)
 *                                this recovers Pappus.
 *
 * The matrices as written do NOT have unit determinant individually (only the
 * product r₁r₂ does). We do not rescale at this layer — downstream numerics
 * (power iteration, projective normalisation) handle scale freely.
 *
 * (Migrated from src/schwartz-pappus/matrices.ts; matrices are now flat `Mat`
 * built with `mat([[…]])`, and the 3×3 algebra comes from core/matrix.)
 */

import { type Mat, mat, matMul, matInverse } from '../../../core/matrix.ts';

// ─── Pappus generators (Schwartz §4.2, Eq. 12 in [S2]) ──────────────────────

/**
 * Order-3 generators (r₁, r₂) at Pappus parameters (c, d) ∈ (-1, 1)².
 * Excludes the degenerate symmetric point (c, d) = (0, 0).
 *
 * r₁ = ρ(σ₃), r₂ = ρ(σ₂σ₃σ₂) generate the index-2 Z/3 ∗ Z/3 subgroup of the
 * modular group. r₁³ and r₂³ are scalar multiples of I; r₁·r₂ is parabolic
 * with trace -1.
 */
export function pappusGenerators(c: number, d: number): { r1: Mat; r2: Mat } {
  if (c === 0 && d === 0) {
    throw new Error('pappusGenerators: (c, d) = (0, 0) is the degenerate symmetric Pappus rep');
  }
  if (c * c >= 1 || d * d >= 1) {
    throw new Error(`pappusGenerators: (c, d) = (${c}, ${d}) must lie in (-1, 1)²`);
  }

  const cd = c * d;
  const k = 1 / ((1 - c * c) * (1 - d * d));
  const r1 = mat([
    [k * (cd - 1),  k * c * (1 - cd),  k * (d - c)],
    [k * (d - c),   k * (1 - cd),      k * (cd - 1)],
    [0,             k * (1 - c * c),   0],
  ]);
  const r2 = mat([
    [-1 - cd,    c + d,    d * (1 + cd)],
    [ 0,         0,        d * d - 1],
    [-(c + d),   1 + cd,   1 + cd],
  ]);
  return { r1, r2 };
}

// ─── BLV/Schwartz morphing (§5.1, Eq. 20 in [S2]) ──────────────────────────

/**
 * Σ(a, b) ∈ SL₃(R) — rational substitute for BLV's transcendental Σ_{δ,ε}.
 * At (a, b) = (1, 1) reduces to I. Conjugating r₂ by Σ moves the rep off the
 * Pappus boundary into the Anosov interior of the Barbot component; r₁ is
 * left unchanged.
 */
export function morphing(a: number, b: number): Mat {
  const bb = b * b;
  const den2b = 1 / (2 * b);
  const m11 = (1 + bb) / (2 * a * b);
  const m12 = (-1 + bb) * den2b;
  const m21 = m12;
  const m22 = a * (1 + bb) * den2b;
  return mat([
    [1,  0,    0],
    [0,  m11,  m12],
    [0,  m21,  m22],
  ]);
}

// ─── Anosov generators (§5, [S2]) ───────────────────────────────────────────

/**
 * Anosov-interior generators: (g₁, g₂) = (r₁, Σ⁻¹ · r₂ · Σ). For these to give
 * a genuine Anosov rep (not just any (a, b, c, d)), (a, b) must lie on the
 * duality curve γ_{c,d}, i.e. ψ(a, b, c, d) = 0. See duality.ts.
 */
export function anosovGenerators(
  c: number, d: number, a: number, b: number,
): { g1: Mat; g2: Mat } {
  const { r1, r2 } = pappusGenerators(c, d);
  if (a === 1 && b === 1) return { g1: r1, g2: r2 };
  const S = morphing(a, b);
  const Sinv = matInverse(S);
  const g2 = matMul(Sinv, matMul(r2, S));
  return { g1: r1, g2 };
}
