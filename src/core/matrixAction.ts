/**
 * The single projective matrix-action engine.
 *
 * A finitely-generated subgroup of GL(n,ℝ) acting on RP^{n-1} (sphere-cover
 * model) is fully described by its ALPHABET — the list of generator matrices in
 * code order, plus an `inverse[]` permutation telling the orbit walker which
 * code undoes which. `makeMatrixAction` turns an Alphabet into the abstract
 * `GroupAction` the orbit walkers consume; it is dimension-generic (n inferred
 * from the matrices) and replaces every per-family action factory
 * (makeMat3Action, makeMat4Action, o5's matrix-table action, sp6's inlined
 * action).
 *
 * Which generating set you WALK is the one real group-theoretic choice, and it
 * lives in the Alphabet you build:
 *   - asInvolutions(mats)    — each generator is its own inverse (Coxeter /
 *                              reflection groups); non-backtracking = reduced
 *                              Coxeter words.
 *   - pairWithInverses(mats) — each generator g gets a computed g⁻¹; codes are
 *                              [g₀, g₀⁻¹, g₁, g₁⁻¹, …] (free group).
 *   - generatingSet(gens)    — the general builder: tag each generator as an
 *                              involution or a free (auto-paired) generator. Use
 *                              for mixed alphabets like {T (involution), B} where
 *                              T = g·f⁻¹ from a free-product structure.
 *
 * The engine is a LIBRARY, not a requirement: an action with structure these
 * builders don't capture (e.g. the complex Möbius action) writes its own `apply`
 * against the GroupAction interface directly.
 */

import type { GroupAction } from './group.ts';
import { type Mat, matDim, matInverse } from './matrix.ts';

/** A generator alphabet in code order, with the inverse permutation. */
export interface Alphabet {
  /** Generator matrices, indexed by generator code. */
  matrices: readonly Mat[];
  /** inverse[g] = code of g⁻¹. */
  inverse: readonly number[];
}

/** One generator: an involution (its own inverse) or a free generator (which
 *  contributes a second code for its computed inverse). */
export interface Gen {
  M: Mat;
  involution?: boolean;
}

// BASEPOINT_SENTINEL = 255 lives in lastGen slots, so codes must stay < 255.
const MAX_GENERATORS = 255;

/**
 * Build an Alphabet from a list of generators. An involution contributes one
 * code (self-inverse); a free generator contributes two consecutive codes
 * (forward then its `matInverse`), with the two `inverse[]` entries swapped.
 */
export function generatingSet(gens: readonly Gen[]): Alphabet {
  const matrices: Mat[] = [];
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
      matrices.push(matInverse(g.M));
      inverse.push(inv);
      inverse.push(fwd);
    }
  }
  if (matrices.length > MAX_GENERATORS) {
    throw new Error(`too many generators (${matrices.length}); BASEPOINT_SENTINEL=255 caps it`);
  }
  return { matrices, inverse };
}

/** Alphabet of involutions: each matrix is its own inverse. */
export const asInvolutions = (mats: readonly Mat[]): Alphabet =>
  generatingSet(mats.map((M) => ({ M, involution: true })));

/** Alphabet of free generators: each matrix is paired with its computed inverse. */
export const pairWithInverses = (mats: readonly Mat[]): Alphabet =>
  generatingSet(mats.map((M) => ({ M })));

/** Sphere-normalize a state of dimension `dim` in place (|v| = 1). Replaces the
 *  per-family normalizeS2…S5. */
export function normalizeSphere(buf: Float64Array, off: number, dim: number): void {
  let s = 0;
  for (let i = 0; i < dim; i++) s += buf[off + i] * buf[off + i];
  if (s === 0) return;
  const inv = 1 / Math.sqrt(s);
  for (let i = 0; i < dim; i++) buf[off + i] *= inv;
}

/**
 * Build the projective GroupAction from an Alphabet. Dimension is inferred from
 * the first matrix; `normalize` (default true) sphere-normalizes after each
 * apply. The apply is the generic row-major matvec, with the source snapshotted
 * into a scratch buffer first so in-place calls (apply(g, buf,0, buf,0), used by
 * power iteration) are safe.
 */
export function makeMatrixAction(
  alph: Alphabet,
  opts: { normalize?: boolean } = {},
): GroupAction {
  const { matrices, inverse } = alph;
  if (matrices.length === 0) throw new Error('makeMatrixAction: empty alphabet');
  const n = matDim(matrices[0]);
  for (const M of matrices) {
    if (matDim(M) !== n) throw new Error('makeMatrixAction: generators have differing dimensions');
  }
  if (inverse.length !== matrices.length) {
    throw new Error('makeMatrixAction: inverse[] length must match matrices[]');
  }

  // One contiguous table for cache-friendly apply.
  const table = new Float64Array(matrices.length * n * n);
  for (let g = 0; g < matrices.length; g++) table.set(matrices[g], g * n * n);
  const scratch = new Float64Array(n);

  function apply(
    g: number,
    src: Float64Array, sOff: number,
    dst: Float64Array, dOff: number,
  ): void {
    for (let c = 0; c < n; c++) scratch[c] = src[sOff + c];
    const base = g * n * n;
    for (let r = 0; r < n; r++) {
      let acc = 0;
      const rowBase = base + r * n;
      for (let c = 0; c < n; c++) acc += table[rowBase + c] * scratch[c];
      dst[dOff + r] = acc;
    }
  }

  const action: GroupAction = {
    numGenerators: matrices.length,
    stateDim: n,
    inverse: Uint8Array.from(inverse),
    apply,
  };
  if (opts.normalize ?? true) {
    action.normalize = (buf, off) => normalizeSphere(buf, off, n);
  }
  return action;
}
