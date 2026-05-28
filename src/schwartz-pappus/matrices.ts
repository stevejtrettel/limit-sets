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
 * The matrices as written do NOT have unit determinant individually (only
 * the product r₁r₂ does). We do not rescale at this layer — downstream
 * numerics (power iteration, projective normalisation) handle scale freely.
 *
 * Local 3×3 linear-algebra helpers (mat3Mul, mat3Inv) live here for
 * symmetry with sl3r/action.ts; only mat3Det is borrowed from there.
 */

import type { Mat3R } from '../sl3r/action.ts';
import { mat3Det } from '../sl3r/action.ts';

export type { Mat3R };

// ─── 3×3 linear algebra (local; mirrors james-marit's hypRep style) ─────────

export function mat3Mul(A: Mat3R, B: Mat3R): Mat3R {
  const out: number[][] = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    let s = 0;
    for (let k = 0; k < 3; k++) s += A[r][k] * B[k][c];
    out[r][c] = s;
  }
  return out as unknown as Mat3R;
}

/** Cofactor inverse. Caller is responsible for `det M ≠ 0`. */
export function mat3Inv(M: Mat3R): Mat3R {
  const a = M[0][0], b = M[0][1], c = M[0][2];
  const d = M[1][0], e = M[1][1], f = M[1][2];
  const g = M[2][0], h = M[2][1], i = M[2][2];
  const det = mat3Det(M);
  const inv = 1 / det;
  return [
    [ (e * i - f * h) * inv, -(b * i - c * h) * inv,  (b * f - c * e) * inv],
    [-(d * i - f * g) * inv,  (a * i - c * g) * inv, -(a * f - c * d) * inv],
    [ (d * h - e * g) * inv, -(a * h - b * g) * inv,  (a * e - b * d) * inv],
  ];
}

export function mat3Trace(M: Mat3R): number {
  return M[0][0] + M[1][1] + M[2][2];
}

// ─── Pappus generators (Schwartz §4.2, Eq. 12 in [S2]) ──────────────────────

/**
 * Order-3 generators (r₁, r₂) at Pappus parameters (c, d) ∈ (-1, 1)².
 * Excludes the degenerate symmetric point (c, d) = (0, 0).
 *
 * r₁ = ρ(σ₃), r₂ = ρ(σ₂σ₃σ₂) generate the index-2 Z/3 ∗ Z/3 subgroup of
 * the modular group. r₁³ and r₂³ are scalar multiples of I; r₁·r₂ is
 * parabolic with trace -1.
 */
export function pappusGenerators(c: number, d: number): { r1: Mat3R; r2: Mat3R } {
  if (c === 0 && d === 0) {
    throw new Error('pappusGenerators: (c, d) = (0, 0) is the degenerate symmetric Pappus rep');
  }
  if (c * c >= 1 || d * d >= 1) {
    throw new Error(`pappusGenerators: (c, d) = (${c}, ${d}) must lie in (-1, 1)²`);
  }

  const cd = c * d;
  const denom = (1 - c * c) * (1 - d * d);
  const k = 1 / denom;
  const r1: Mat3R = [
    [k * (cd - 1),     k * c * (1 - cd),  k * (d - c)],
    [k * (d - c),      k * (1 - cd),      k * (cd - 1)],
    [0,                k * (1 - c * c),   0],
  ];

  const r2: Mat3R = [
    [-1 - cd,        c + d,            d * (1 + cd)],
    [ 0,             0,                d * d - 1],
    [-(c + d),       1 + cd,           1 + cd],
  ];

  return { r1, r2 };
}

// ─── BLV/Schwartz morphing (§5.1, Eq. 20 in [S2]) ──────────────────────────

/**
 * Σ(a, b) ∈ SL₃(R) — rational substitute for BLV's transcendental Σ_{δ,ε}.
 * At (a, b) = (1, 1) reduces to I. Conjugating r₂ by Σ moves the rep off
 * the Pappus boundary into the Anosov interior of the Barbot component;
 * r₁ is left unchanged.
 */
export function morphing(a: number, b: number): Mat3R {
  const bb = b * b;
  const den2b = 1 / (2 * b);
  const m11 = (1 + bb) / (2 * a * b);
  const m12 = (-1 + bb) * den2b;
  const m21 = m12;
  const m22 = a * (1 + bb) * den2b;
  return [
    [1,  0,    0],
    [0,  m11,  m12],
    [0,  m21,  m22],
  ];
}

// ─── Anosov generators (§5, [S2]) ───────────────────────────────────────────

/**
 * Anosov-interior generators: (g₁, g₂) = (r₁, Σ⁻¹ · r₂ · Σ).
 * For these to give a genuine Anosov rep (not just any (a, b, c, d)),
 * (a, b) must lie on the duality curve γ_{c,d}, i.e. ψ(a, b, c, d) = 0.
 * See duality.ts.
 */
export function anosovGenerators(
  c: number, d: number, a: number, b: number,
): { g1: Mat3R; g2: Mat3R } {
  const { r1, r2 } = pappusGenerators(c, d);
  if (a === 1 && b === 1) {
    return { g1: r1, g2: r2 };
  }
  const S = morphing(a, b);
  const Sinv = mat3Inv(S);
  const g2 = mat3Mul(Sinv, mat3Mul(r2, S));
  return { g1: r1, g2 };
}
