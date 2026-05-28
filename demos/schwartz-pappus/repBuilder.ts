/**
 * Schwartz–Pappus rep assembly: (c, d, b) → SL3RExample.
 *
 * Steps:
 *   1. Solve a from ψ(a, b, c, d) = 0 on the Anosov branch via Brent.
 *   2. Build the two order-3 generators (r₁, Σ⁻¹ r₂ Σ) at (c, d, a, b).
 *   3. Wrap in the demo's generic SL3RExample shape — fed to a 2-letter
 *      F₂-style walker via makeMat3Action({ involutions: false }). The
 *      walker treats {r₁, r₂} as two free generators with auto-computed
 *      inverses; the relation r_i³ ≡ scalar·I is not enforced by the
 *      walker, so some orbit points are visited redundantly. Correct;
 *      noted as the "depth 12 ≈ live, depth 15+ wasteful" tradeoff.
 *
 * γ choice. Default γ = r₁ · r₂² (codes [0, 3] under involutions:false
 * encoding: 0 = r₁ forward, 1 = r₁⁻¹, 2 = r₂ forward, 3 = r₂⁻¹; and
 * r₂² ≡ r₂⁻¹ projectively since r₂³ ≡ I). Eq. 13 of [S2] gives
 * τ(r₁r₂²) = 64/[(1-c²)(1-d²)²], finite and positive for (c, d) ∈
 * (-1, 1)², so this stays loxodromic across the Pappus parameter
 * square. Holds along the Anosov sweep too (the morphing is continuous).
 */

import type { SL3RExample } from '@/sl3r/examples';
import { anosovGenerators } from '@/schwartz-pappus/matrices';
import { solveDualityA } from '@/schwartz-pappus/duality';

export interface PappusParams {
  c: number;
  d: number;
  b: number;
}

export interface PappusBuild {
  example: SL3RExample;
  /** Computed Anosov-branch a, for display. */
  a: number;
}

const POWER_ITER = 80;

/**
 * Build the Schwartz–Pappus SL3RExample at (c, d, b). Solves the duality
 * equation for a internally, throws if (c, d) is the degenerate symmetric
 * point (0, 0) or if b < 1 (off the parametrising arc).
 */
export function buildExample(params: PappusParams): PappusBuild {
  const { c, d, b } = params;
  if (c === 0 && d === 0) {
    throw new Error('buildExample: (c, d) = (0, 0) is the degenerate symmetric Pappus rep');
  }
  if (b < 1) {
    throw new Error(`buildExample: b = ${b} < 1; the duality curve has b ≥ 1`);
  }

  const a = solveDualityA(b, c, d);
  const { g1, g2 } = anosovGenerators(c, d, a, b);

  const example: SL3RExample = {
    id: `pappus-c${c.toFixed(3)}-d${d.toFixed(3)}-b${b.toFixed(3)}`,
    label: `Schwartz–Pappus (c=${c.toFixed(3)}, d=${d.toFixed(3)}, b=${b.toFixed(3)})`,
    description:
      `Index-2 Z/3 ∗ Z/3 subgroup of the modular group at Pappus params ` +
      `(c, d) = (${c.toFixed(3)}, ${d.toFixed(3)}), morphed to the Anosov ` +
      `interior at b = ${b.toFixed(3)} (a = ${a.toFixed(4)} from ψ = 0).`,
    generators: [g1, g2],
    involutions: false,
    // γ = r₁ · r₂² ≡ r₁ · r₂⁻¹ projectively (since r₂³ ≡ scalar·I).
    // Under involutions:false, code 0 = g₁, 1 = g₁⁻¹, 2 = g₂, 3 = g₂⁻¹.
    gamma: [0, 3],
    gammaName: 'r₁·r₂²',
    powerIter: POWER_ITER,
  };

  return { example, a };
}
