/**
 * The complex counterpart of `matrixAction.ts`: one projective engine for
 * finitely-generated subgroups of GL(n,C) acting on CP^{n-1}.
 *
 * The state is the realified vector z ∈ Cⁿ ↔ [Re z₁, Im z₁, …] ∈ R²ⁿ
 * (stateDim = 2n), sphere-normalized on S^{2n-1} — the circle-bundle cover of
 * CP^{n-1}. Downstream embeddings must therefore be PHASE-INVARIANT (use
 * ratios zᵢ/zⱼ), exactly as the Kleinian Hopf/stereographic maps are.
 *
 * The alphabet builders mirror the real engine one-for-one:
 *   - asComplexInvolutions(mats)    — each generator its own inverse
 *                                     (complex reflection groups);
 *   - pairWithComplexInverses(mats) — free group, inverses computed;
 *   - complexGeneratingSet(gens)    — mixed involution / free alphabets.
 *
 * The Kleinian family keeps its bespoke 2×2 apply (it predates this engine and
 * reads well); scripts/tests/su21-gates.ts pins this engine against it as an
 * independent reference.
 */

import type { GroupAction } from './group.ts';
import { type CMat, cmatDim, cmatInverse } from './complexMatrix.ts';
import { normalizeSphere } from './matrixAction.ts';

/** A complex generator alphabet in code order, with the inverse permutation. */
export interface ComplexAlphabet {
  /** Generator matrices, indexed by generator code. */
  matrices: readonly CMat[];
  /** inverse[g] = code of g⁻¹. */
  inverse: readonly number[];
}

/** One generator: an involution (its own inverse) or a free generator (which
 *  contributes a second code for its computed inverse). */
export interface CGen {
  M: CMat;
  involution?: boolean;
}

// BASEPOINT_SENTINEL = 255 lives in lastGen slots, so codes must stay < 255.
const MAX_GENERATORS = 255;

/**
 * Build a ComplexAlphabet from a list of generators. An involution contributes
 * one code (self-inverse); a free generator contributes two consecutive codes
 * (forward then its `cmatInverse`), with the two `inverse[]` entries swapped.
 */
export function complexGeneratingSet(gens: readonly CGen[]): ComplexAlphabet {
  const matrices: CMat[] = [];
  const inverse: number[] = [];
  for (const g of gens) {
    if (g.involution) {
      const code = matrices.length;
      matrices.push(g.M);
      inverse.push(code);
    } else {
      const fwd = matrices.length;
      const inv = fwd + 1;
      matrices.push(g.M);
      matrices.push(cmatInverse(g.M));
      inverse.push(inv);
      inverse.push(fwd);
    }
  }
  if (matrices.length > MAX_GENERATORS) {
    throw new Error(`too many generators (${matrices.length}); BASEPOINT_SENTINEL=255 caps it`);
  }
  return { matrices, inverse };
}

/** Alphabet of involutions: each complex matrix is its own inverse. */
export const asComplexInvolutions = (mats: readonly CMat[]): ComplexAlphabet =>
  complexGeneratingSet(mats.map((M) => ({ M, involution: true })));

/** Alphabet of free generators: each matrix paired with its computed inverse. */
export const pairWithComplexInverses = (mats: readonly CMat[]): ComplexAlphabet =>
  complexGeneratingSet(mats.map((M) => ({ M })));

/**
 * Build the projective GroupAction from a ComplexAlphabet. Dimension n is
 * inferred from the first matrix; stateDim = 2n (realified). `normalize`
 * (default true) sphere-normalizes after each apply. The apply snapshots the
 * source into a scratch buffer first, so in-place calls
 * (apply(g, buf,0, buf,0), used by power iteration) are safe.
 */
export function makeComplexMatrixAction(
  alph: ComplexAlphabet,
  opts: { normalize?: boolean } = {},
): GroupAction {
  const { matrices, inverse } = alph;
  if (matrices.length === 0) throw new Error('makeComplexMatrixAction: empty alphabet');
  const n = cmatDim(matrices[0]);
  for (const M of matrices) {
    if (cmatDim(M) !== n) {
      throw new Error('makeComplexMatrixAction: generators have differing dimensions');
    }
  }
  if (inverse.length !== matrices.length) {
    throw new Error('makeComplexMatrixAction: inverse[] length must match matrices[]');
  }

  // One contiguous table for cache-friendly apply (2n² doubles per generator).
  const table = new Float64Array(matrices.length * 2 * n * n);
  for (let g = 0; g < matrices.length; g++) table.set(matrices[g], g * 2 * n * n);
  const scratch = new Float64Array(2 * n);

  function apply(
    g: number,
    src: Float64Array, sOff: number,
    dst: Float64Array, dOff: number,
  ): void {
    for (let c = 0; c < 2 * n; c++) scratch[c] = src[sOff + c];
    const base = g * 2 * n * n;
    for (let r = 0; r < n; r++) {
      let accR = 0, accI = 0;
      const rowBase = base + 2 * r * n;
      for (let c = 0; c < n; c++) {
        const mr = table[rowBase + 2 * c], mi = table[rowBase + 2 * c + 1];
        const vr = scratch[2 * c], vi = scratch[2 * c + 1];
        accR += mr * vr - mi * vi;
        accI += mr * vi + mi * vr;
      }
      dst[dOff + 2 * r]     = accR;
      dst[dOff + 2 * r + 1] = accI;
    }
  }

  const action: GroupAction = {
    numGenerators: matrices.length,
    stateDim: 2 * n,
    inverse: Uint8Array.from(inverse),
    apply,
  };
  if (opts.normalize ?? true) {
    action.normalize = (buf, off) => normalizeSphere(buf, off, 2 * n);
  }
  return action;
}
