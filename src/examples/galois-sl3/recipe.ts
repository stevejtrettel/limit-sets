/**
 * The recipe: a quadratic unit → the group action on RP⁵, and a basepoint on the
 * limit set.
 *
 * THE CONSTRUCTION. For t a unit of 𝒪_K, the pair ⟨A(t), B(t)⟩ lies in
 * SL(3, 𝒪_K), and the standard embedding of that ring into ℝ×ℝ by its two real
 * places gives the discrete embedding
 *
 *   γ  ↦  (γ, γ^σ)  ∈  SL(3,ℝ) × SL(3,ℝ)  ⊂  SL(6,ℝ),   as  diag(γ, γ^σ),
 *
 * where γ^σ applies the nontrivial Galois automorphism entrywise. The family is
 * ℤ[t,1/t]-rational, so γ^σ is just γ with t replaced by t^σ — hence
 * `generatorsAt(u.tSigma)` and nothing more.
 *
 * THE SEED. diag(ρ, ρ^σ) preserves both coordinate 3-planes ℝ³⊕0 and 0⊕ℝ³, so a
 * proximal element of the 6×6 has its attracting fixed point INSIDE one of them:
 * seeding with the ordinary `seedFromLoxodromic` would trap the orbit in a
 * projective plane and redraw a single SL(3,ℝ) picture. `seedGalois` instead uses
 * `seedFromBlockLoxodromic` — one word proximal in BOTH factors, joined from the
 * two attracting fixed points ξ₊(ρ(w)) and ξ₊(ρ^σ(w)). That point lies on neither
 * plane, and its orbit accumulates on the join of Λ_ρ and Λ_{ρ^σ}, the limit set
 * of the product action in RP⁵.
 *
 * The block-by-block search is also strictly easier here: every word of length
 * ≤ 3 has spectrum {λ, 1, 1/λ} in each factor, so the two factors' dominant
 * moduli TIE and the 6×6 is non-proximal until length 4 — while each factor
 * alone is already proximal at length 1.
 *
 * `seedFactor` is kept as the deliberate diagnostic: it produces exactly the
 * degenerate in-plane basepoint, so the demo can show the trapped orbit next to
 * the joined one rather than hiding the distinction.
 */

import type { GroupAction } from '../../core/group.ts';
import { matBlockDiag } from '../../core/matrix.ts';
import { makeMatrixAction, pairWithInverses } from '../../core/matrixAction.ts';
import {
  seedFromBlockLoxodromic, seedFromLoxodromic,
  type BlockSeed, type Seed,
} from '../../core/seed.ts';
import { generatorsAt, GENERATOR_LABELS } from './family.ts';
import type { QuadraticUnit } from './quadratic.ts';

/** The single factor ρ_t on RP²: the free pair ⟨A(t), B(t)⟩ in SL(3,ℝ). */
export function sl3Action(t: number): GroupAction {
  return makeMatrixAction(pairWithInverses(generatorsAt(t)));
}

/** The two Galois factors [ρ, ρ^σ], sharing one alphabet (code order matters:
 *  `seedFromBlockLoxodromic` walks one word through both). */
export function factorActions(u: QuadraticUnit): [GroupAction, GroupAction] {
  return [sl3Action(u.t), sl3Action(u.tSigma)];
}

/** The Galois embedding ⟨diag(A, A^σ), diag(B, B^σ)⟩ ⊂ SL(6,ℝ), acting on RP⁵. */
export function galoisAction(u: QuadraticUnit): GroupAction {
  const g = generatorsAt(u.t);
  const gs = generatorsAt(u.tSigma);
  return makeMatrixAction(pairWithInverses([
    matBlockDiag([g[0], gs[0]]),
    matBlockDiag([g[1], gs[1]]),
  ]));
}

/** Which basepoint the RP⁵ orbit starts from. */
export type SeedMode = 'join' | 'factor1' | 'factor2';

export const SEED_MODE_LABELS: Record<SeedMode, string> = {
  join:    'join ξ₊(ρ) ⊕ ξ₊(ρ^σ)  (RP⁵)',
  factor1: 'factor ρ only  (trapped in RP²)',
  factor2: 'factor ρ^σ only  (trapped in RP²)',
};

/**
 * The default basepoint: the join of the two factors' attracting fixed points
 * for one word proximal in both. Returns the per-factor |λ| and the binding
 * spectral gap alongside the usual Seed fields.
 */
export function seedGalois(u: QuadraticUnit): BlockSeed {
  return seedFromBlockLoxodromic(factorActions(u), { labels: GENERATOR_LABELS });
}

/**
 * Diagnostic basepoint: one factor's proximal fixed point, zero-padded into ℝ⁶.
 * The orbit of this point never leaves that factor's coordinate 3-plane — it is
 * the plain SL(3,ℝ) limit set of ρ (or ρ^σ) sitting inside RP⁵.
 */
export function seedFactor(u: QuadraticUnit, which: 0 | 1): Seed {
  const [rho, rhoSigma] = factorActions(u);
  const s = seedFromLoxodromic(which === 0 ? rho : rhoSigma, { labels: GENERATOR_LABELS });
  const basepoint = new Float64Array(6);
  basepoint.set(s.basepoint, which === 0 ? 0 : 3);
  return { ...s, basepoint };
}

/** Basepoint for a seed mode, as the demo's dropdown selects it. */
export function seedFor(u: QuadraticUnit, mode: SeedMode): Seed {
  if (mode === 'factor1') return seedFactor(u, 0);
  if (mode === 'factor2') return seedFactor(u, 1);
  return seedGalois(u);
}
