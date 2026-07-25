/**
 * Restrict a matrix group action to the invariant subspace spanned by an orbit.
 *
 * WHY. A linear group G ⊂ GL(n,ℝ) can be REDUCIBLE: the G-orbit of a single
 * point ξ spans a proper subspace V = span(G·ξ) ⊊ ℝⁿ, and since g·(G·ξ) ⊆ G·ξ
 * for every generator, V is automatically G-invariant. The whole limit set of ξ
 * then lives in ℙ(V) = RP^{k−1} with k = dim V < n, and the "interesting"
 * representation is the k×k restriction G|_V. Drawing there is both cheaper and
 * geometrically honest (no phantom ambient dimensions).
 *
 * HOW. We recover V empirically from a pilot orbit — it is exactly the column
 * span of the orbit vectors — via the orbit Gram matrix
 *     M = (1/N) Σ_i v_i v_iᵀ   (n×n, symmetric PSD).
 * The eigenvectors of M with nonzero eigenvalue span V; the zero eigenvalues
 * count the codimension. Take the top-k unit eigenvectors as the ROWS of an
 * orthonormal frame B (k×n), so B Bᵀ = I_k and Bᵀ B = P_V (orthogonal
 * projector onto V). The restriction of a generator g to V, in the B-frame, is
 *     C = B g Bᵀ        (k×k).
 * Because V is invariant, g Bᵀ already lands in V, so this is EXACT, not a
 * least-squares fit — certified by `invarianceResidual` = max‖g Bᵀ − Bᵀ C‖,
 * which is 0 (to rounding) exactly when the chosen frame spans a true invariant
 * subspace. Involutions restrict to involutions (C² = B g Bᵀ B g Bᵀ =
 * B g P_V g Bᵀ = B g² Bᵀ = I since g Bᵀ ∈ V ⇒ P_V g Bᵀ = g Bᵀ), and the inverse
 * permutation of the alphabet is preserved, so the restricted action keeps the
 * original's group structure — only the dimension drops.
 *
 * This is a generic core ability: it speaks only to `GroupAction`, carries no
 * family data, and works in any dimension.
 */

import type { GroupAction } from './group.ts';
import type { Alphabet } from './matrixAction.ts';
import { makeMatrixAction } from './matrixAction.ts';
import { generateOrbit } from './orbit.ts';
import { jacobiSymmetricEig } from './linalg.ts';
import { type Mat, mat } from './matrix.ts';

export interface OrbitSpanRestriction {
  /** k = dim V (numerical rank of the orbit span). */
  dim: number;
  /** n = ambient dimension of the original action. */
  ambientDim: number;
  /** Orthonormal frame B, k rows × n cols; rows span V, B Bᵀ = I_k. */
  basis: number[][];
  /** Restricted alphabet: k×k generators Cᵢ = B gᵢ Bᵀ (code order preserved)
   *  plus the original inverse permutation — feed straight to makeMatrixAction. */
  alphabet: Alphabet;
  /** Orbit-Gram eigenvalues, descending — the spectrum that reveals the rank. */
  eigenvalues: number[];
  /** λ_k / λ_{k+1}: the gap that separates V from its complement. ∞ if k = n. */
  spectralGap: number;
  /** max over generators of ‖gᵢ Bᵀ − Bᵀ Cᵢ‖∞ — 0 ⟺ V is exactly invariant. */
  invarianceResidual: number;
  /** Project an ambient vector into the B-frame: returns B·v ∈ ℝᵏ. */
  project(v: Float64Array, off?: number): Float64Array;
}

/**
 * Find V = span(orbit of `basepoint`) and restrict `action` to it.
 *
 * `depth` sizes the pilot orbit (must be deep enough to fill V — a handful of
 * BFS levels suffices for a low-dimensional invariant subspace). `rankTol` is
 * the relative eigenvalue floor: a Gram eigenvalue below `rankTol·λ_max` counts
 * as zero (out of V). Throws if the detected rank is 0 or n (n ⇒ irreducible on
 * this orbit: no proper invariant subspace to restrict to).
 */
export function restrictToOrbitSpan(
  action: GroupAction,
  basepoint: Float64Array,
  opts: { depth?: number; rankTol?: number } = {},
): OrbitSpanRestriction {
  const { depth = 12, rankTol = 1e-9 } = opts;
  const n = action.stateDim;

  // Orbit Gram M = Σ v vᵀ (unnormalized — scale is irrelevant to eigenvectors).
  const orbit = generateOrbit(action, basepoint, depth);
  const M: number[][] = Array.from({ length: n }, () => Array<number>(n).fill(0));
  for (let i = 0; i < orbit.count; i++) {
    const off = i * n;
    for (let a = 0; a < n; a++) {
      for (let b = a; b < n; b++) M[a][b] += orbit.vecs[off + a] * orbit.vecs[off + b];
    }
  }
  for (let a = 0; a < n; a++) for (let b = a; b < n; b++) M[b][a] = M[a][b];

  const { vals, vecs } = jacobiSymmetricEig(M, n);
  const order = vals.map((v, i) => ({ v, i })).sort((p, q) => q.v - p.v).map((x) => x.i);
  const eigenvalues = order.map((i) => vals[i]);

  const lamMax = eigenvalues[0];
  let k = 0;
  while (k < n && eigenvalues[k] > rankTol * lamMax) k++;
  if (k === 0) throw new Error('restrictToOrbitSpan: orbit spans nothing (basepoint ≈ 0?)');
  if (k === n) {
    throw new Error(
      `restrictToOrbitSpan: orbit is full-rank (k = n = ${n}); the action is irreducible ` +
      'on this orbit, so there is no proper invariant subspace to restrict to.',
    );
  }
  const spectralGap = eigenvalues[k] > 0 ? eigenvalues[k - 1] / eigenvalues[k] : Infinity;

  // Orthonormal frame B: top-k eigenvectors as rows.
  const B: number[][] = order.slice(0, k).map((i) => vecs[i].slice());

  const project = (v: Float64Array, off = 0): Float64Array => {
    const out = new Float64Array(k);
    for (let a = 0; a < k; a++) {
      let s = 0;
      for (let j = 0; j < n; j++) s += B[a][j] * v[off + j];
      out[a] = s;
    }
    return out;
  };

  // Restrict each generator: Cᵢ = B gᵢ Bᵀ, computed column-by-column as
  // gᵢ·(row b of B), then projected. Track the out-of-V residual as certification.
  const scratchIn = new Float64Array(n);
  const scratchOut = new Float64Array(n);
  const matrices: Mat[] = [];
  let invarianceResidual = 0;
  for (let g = 0; g < action.numGenerators; g++) {
    const C: number[][] = Array.from({ length: k }, () => Array<number>(k).fill(0));
    for (let beta = 0; beta < k; beta++) {
      for (let j = 0; j < n; j++) scratchIn[j] = B[beta][j];
      action.apply(g, scratchIn, 0, scratchOut, 0);   // w = gᵢ · b_beta
      for (let alpha = 0; alpha < k; alpha++) {
        let s = 0;
        for (let j = 0; j < n; j++) s += B[alpha][j] * scratchOut[j];
        C[alpha][beta] = s;                             // (Cᵢ)_{alpha,beta} = b_alpha · w
      }
      // residual = ‖w − P_V w‖∞ (component of w outside V)
      for (let j = 0; j < n; j++) {
        let pv = 0;
        for (let alpha = 0; alpha < k; alpha++) pv += C[alpha][beta] * B[alpha][j];
        invarianceResidual = Math.max(invarianceResidual, Math.abs(scratchOut[j] - pv));
      }
    }
    matrices.push(mat(C));
  }

  const alphabet: Alphabet = { matrices, inverse: Array.from(action.inverse) };

  return {
    dim: k, ambientDim: n, basis: B, alphabet,
    eigenvalues, spectralGap, invarianceResidual, project,
  };
}

/** Build the restricted GroupAction on ℙ(V) = RP^{k−1} from a restriction. */
export function restrictedAction(r: OrbitSpanRestriction): GroupAction {
  return makeMatrixAction(r.alphabet);
}
