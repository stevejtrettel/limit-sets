/**
 * Top-level assembly: (SO21Rep, Cohomology, cocycle sextuple) →
 * `SL4RExample` consumable by the rest of the limit-set pipeline.
 *
 * Pipeline per generator g ∈ {a, b}:
 *   1. ρ(g) ∈ SO(2,1) ⊂ SL(3, R)          supplied directly (so21Rep.ts)
 *   2. exp(−φ(g)) · ρ(g)         ∈ GL(3, R)         scaled by cohom (= χ·ρ(g))
 *   3. 4×4 block with v(g) row at the bottom and (0,0,0,1) column
 *
 * The cocycle space is computed from the scaled 3×3 blocks (step 2 above),
 * not from the raw SO(2,1) matrices. The condition v_{[a,b]} = 0 is then
 * linear in v.
 */

import type { Mat4R } from '@/sl4r/action';
import type { SL4RExample } from '@/sl4r/types';
import type { SO21Rep } from './so21Rep';
import type { Cohomology } from './cohomology';
import { scale3, type Mat3R } from './symSquare';
import { type Vec6 } from './cocycle';

export interface ScaledBlocks {
  /** exp(−φ(a)) · ρ(a) = χ_A · A */
  A: Mat3R;
  /** exp(−φ(b)) · ρ(b) = χ_B · B */
  B: Mat3R;
}

export function scaledBlocks(rep: SO21Rep, coho: Cohomology): ScaledBlocks {
  return {
    A: scale3(rep.A, Math.exp(-coho.phiA)),
    B: scale3(rep.B, Math.exp(-coho.phiB)),
  };
}

function assemble4(block: Mat3R, v: readonly [number, number, number]): Mat4R {
  return [
    [block[0][0], block[0][1], block[0][2], 0],
    [block[1][0], block[1][1], block[1][2], 0],
    [block[2][0], block[2][1], block[2][2], 0],
    [v[0],        v[1],        v[2],        1],
  ];
}

export function buildExample(
  rep: SO21Rep,
  coho: Cohomology,
  v: Vec6,
  blocks: ScaledBlocks = scaledBlocks(rep, coho),
): SL4RExample {
  const genA = assemble4(blocks.A, [v[0], v[1], v[2]]);
  const genB = assemble4(blocks.B, [v[3], v[4], v[5]]);
  return {
    id: 'james-marit-new',
    label: 'james–marit (fixed SO(2,1) rep)',
    description:
      'ρ : F₂ → SO(2,1) (fixed matrices), φ : F₂ → R, v : F₂ → R³ cocycle ' +
      'with v_[a,b] = 0. 4×4 generator = [exp(−φ(g))·ρ(g), 0; v(g), 1].',
    generators: [genA, genB],
    involutions: false,
    gamma:     [2],   // 0=A, 1=A⁻¹, 2=B, 3=B⁻¹ — γ = B is loxodromic (eigenvalues 3+2√2, 1, 3−2√2)
    gammaName: 'B',
    powerIter: 200,
  };
}
