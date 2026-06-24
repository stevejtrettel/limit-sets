/**
 * Schwartz–Pappus rep recipe: (c, d, b) → GroupAction.
 *
 * The construction (mirrors the hypergeometric recipe — parameters → matrices →
 * action):
 *   1. Solve a from ψ(a, b, c, d) = 0 on the Anosov branch (Brent; duality.ts).
 *   2. Build the two order-3 generators (g₁, g₂) = (r₁, Σ⁻¹ r₂ Σ).
 *   3. Walk them as a free pair {g₁, g₁⁻¹, g₂, g₂⁻¹} via makeMatrixAction. The
 *      relation gᵢ³ ≡ scalar·I is NOT enforced by the walker, so some orbit
 *      points are revisited — correct, just the "depth 12 ≈ live, depth 15+
 *      wasteful" tradeoff.
 *
 * Seeding is EXPLICIT (not auto-searched): γ = r₁·r₂² stays loxodromic across
 * the whole Pappus square (Eq. 13 of [S2]: τ(r₁r₂²) = 64/[(1-c²)(1-d²)²],
 * finite & positive), giving a basepoint that varies CONTINUOUSLY as the live
 * (c, d, b) sliders move — whereas the shortest-loxodromic word could jump
 * between params. This is the canonical `seedFromWord` override case.
 */

import { type Mat } from '../../../core/matrix.ts';
import { makeMatrixAction, pairWithInverses } from '../../../core/matrixAction.ts';
import { seedFromWord, type Seed } from '../../../core/seed.ts';
import type { GroupAction } from '../../../core/group.ts';
import { anosovGenerators } from './matrices.ts';
import { solveDualityA } from './duality.ts';

/** Anosov generators (g₁, g₂) at (c, d, b), plus the solved duality value a.
 *  Throws on the degenerate symmetric point (0,0) or b < 1 (off the arc). */
export function pappusRep(c: number, d: number, b: number): { generators: [Mat, Mat]; a: number } {
  if (c === 0 && d === 0) {
    throw new Error('pappusRep: (c, d) = (0, 0) is the degenerate symmetric Pappus rep');
  }
  if (b < 1) {
    throw new Error(`pappusRep: b = ${b} < 1; the duality curve has b ≥ 1`);
  }
  const a = solveDualityA(b, c, d);
  const { g1, g2 } = anosovGenerators(c, d, a, b);
  return { generators: [g1, g2], a };
}

/** The GroupAction at (c, d, b): the free pair {g₁, g₁⁻¹, g₂, g₂⁻¹}. */
export function pappusAction(c: number, d: number, b: number): GroupAction {
  return makeMatrixAction(pairWithInverses(pappusRep(c, d, b).generators));
}

/** γ = r₁·r₂² (codes [0, 3]: r₁ · r₂⁻¹ ≡ r₁r₂² since r₂³ ≡ scalar·I). */
export const PAPPUS_SEED: readonly number[] = [0, 3];

/** Limit-set basepoint via the explicit, parameter-stable seed word. */
export const seedPappus = (action: GroupAction): Seed =>
  seedFromWord(action, PAPPUS_SEED, { iters: 80, name: 'r₁·r₂²' });
