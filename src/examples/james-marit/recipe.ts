/**
 * James–Marit recipe: (SO(2,1) base rep, cohomology twist, cocycle) → SL(4,ℝ)
 * GroupAction. The construction is an affine cohomological deformation of a
 * once-punctured-torus rep:
 *
 *   block(g) = exp(−φ(g)) · ρ(g)              ∈ GL(3,ℝ)      (scaledBlocks)
 *   gen(g)   = [ block(g)  0 ; v(g)  1 ]      ∈ GL(4,ℝ)      (assemble)
 *
 * with v the peripheral cocycle (v_{[a,b]} = 0; see cocycle.ts). Seeding is
 * EXPLICIT: γ = B is loxodromic (eigenvalues 3+2√2, 1, 3−2√2), giving a stable
 * basepoint as the live α / s sliders move — the `seedFromWord` override case.
 */

import { type Mat, matScale } from '../../core/matrix.ts';
import { makeMatrixAction, pairWithInverses } from '../../core/matrixAction.ts';
import { seedFromWord, type Seed } from '../../core/seed.ts';
import type { GroupAction } from '../../core/group.ts';
import type { SO21Rep } from './so21Rep.ts';
import type { Cohomology } from './cohomology.ts';
import { type Vec6 } from './cocycle.ts';

export interface ScaledBlocks {
  /** exp(−φ(a)) · ρ(a) = χ_A · A */
  A: Mat;
  /** exp(−φ(b)) · ρ(b) = χ_B · B */
  B: Mat;
}

export function scaledBlocks(rep: SO21Rep, coho: Cohomology): ScaledBlocks {
  return {
    A: matScale(rep.A, Math.exp(-coho.phiA)),
    B: matScale(rep.B, Math.exp(-coho.phiB)),
  };
}

/** 3×3 block (flat 9) + v ∈ ℝ³ → 4×4 flat generator [block 0; v 1]. */
function assemble4(block: Mat, v0: number, v1: number, v2: number): Mat {
  const M = new Float64Array(16);
  M[0]  = block[0]; M[1]  = block[1]; M[2]  = block[2]; M[3]  = 0;
  M[4]  = block[3]; M[5]  = block[4]; M[6]  = block[5]; M[7]  = 0;
  M[8]  = block[6]; M[9]  = block[7]; M[10] = block[8]; M[11] = 0;
  M[12] = v0;       M[13] = v1;       M[14] = v2;       M[15] = 1;
  return M;
}

/** The two 4×4 generators (genA, genB) from the scaled blocks + cocycle sextuple. */
export function jamesMaritGenerators(blocks: ScaledBlocks, v: Vec6): [Mat, Mat] {
  return [
    assemble4(blocks.A, v[0], v[1], v[2]),
    assemble4(blocks.B, v[3], v[4], v[5]),
  ];
}

/** The GroupAction: the free pair {A, A⁻¹, B, B⁻¹}. */
export function jamesMaritAction(blocks: ScaledBlocks, v: Vec6): GroupAction {
  return makeMatrixAction(pairWithInverses(jamesMaritGenerators(blocks, v)));
}

/** γ = B (generator code [2]). */
export const JAMES_MARIT_SEED: readonly number[] = [2];

/** Limit-set basepoint via the explicit, parameter-stable seed word γ = B. */
export const seedJamesMarit = (action: GroupAction): Seed =>
  seedFromWord(action, JAMES_MARIT_SEED, { iters: 200, name: 'B' });
