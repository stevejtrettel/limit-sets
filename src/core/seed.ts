/**
 * Group-agnostic loxodromic-word search and limit-set seeding.
 *
 * To draw a limit set we need a basepoint that lies ON it. The attracting fixed
 * point of a loxodromic element is such a point, and power iteration converges to
 * it crisply. Rather than hand-pick a γ word per group, this module SEARCHES the
 * (non-backtracking) word tree of any GroupAction and returns the shortest word
 * whose spectrum certifies it loxodromic — tested directly from the
 * characteristic polynomial (Faddeev–LeVerrier) + complex roots (Durand–Kerner),
 * NOT from a power-iteration λ-estimate (a parabolic estimate sits just above 1
 * at finite iteration counts and fools a threshold test).
 *
 * Everything works through the `GroupAction` interface alone, so it serves any
 * LINEAR matrix action (hypergeometric, projective slₙℝ, …). The one axis of
 * variation is the loxodromic CRITERION:
 *   - `realDominantCriterion`    — a single REAL dominant eigenvalue |λ|>1 (the
 *     real projective families).
 *   - `complexDominantCriterion` — dominant MODULUS isolated, allowing a
 *     conjugate pair at the top (complex Möbius-type actions; needs a complex
 *     basepoint step, not yet wired into `seedFromLoxodromic`).
 *
 * `seedFromLoxodromic` is the one-call front door: find the word, power-iterate
 * to its fixed point, return a Seed (with an optional parabolic-word fallback).
 * `seedFromBlockLoxodromic` is its counterpart for BLOCK-SUM actions (ρ₀ ⊕ ρ₁ ⊕
 * …), where the plain front door would trap the orbit inside one block; it seeks
 * a word proximal in every factor and joins the per-factor fixed points.
 *
 * (This file was `loxodromic.ts`; `core/loxodromic.ts` is now a re-export shim
 * for the duration of the refactor. It also absorbs the genericized version of
 * the old o5/seed.ts.)
 */

import type { GroupAction } from './group.ts';
import { type Complex, complexAbs as cAbs, charPoly, polyRoots } from './linalg.ts';
import { computeProximalBasepoint } from './orbit.ts';

// ─── Word matrix + spectrum ──────────────────────────────────────────────────

/** The n×n matrix of `word` (apply-order generator codes), built by pushing the
 *  standard basis through `action.apply`. `apply` does not normalize, so this is
 *  the true linear map. */
export function wordMatrix(action: GroupAction, word: readonly number[]): number[][] {
  const n = action.stateDim;
  const M: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (let j = 0; j < n; j++) {
    let cur = new Float64Array(n); cur[j] = 1;
    for (const g of word) {
      const out = new Float64Array(n);
      action.apply(g, cur, 0, out, 0);
      cur = out;
    }
    for (let i = 0; i < n; i++) M[i][j] = cur[i]; // column j
  }
  return M;
}

/** Eigenvalues of `word` under `action`, sorted by descending modulus
 *  (char poly + complex roots, both from @/core/linalg). */
export function wordEigenvalues(action: GroupAction, word: readonly number[]): Complex[] {
  return polyRoots(charPoly(wordMatrix(action, word)));
}

// ─── Loxodromic criteria ─────────────────────────────────────────────────────

/** Given eigenvalues sorted by descending modulus, return |λ_dominant| if the
 *  word qualifies as loxodromic-for-seeding, else null. */
export type LoxodromicCriterion = (eigs: Complex[]) => number | null;

const EXPAND = 1.001;   // |λ| must exceed this to count as expanding
const ISO = 1e-4;       // dominant must beat the next modulus by this margin
const REAL = 1e-6;      // |im| < REAL·|λ| counts the dominant as real

/** Overrides for the criterion thresholds. The one that matters in practice is
 *  `expand`: a PARABOLIC word has a high-multiplicity eigenvalue on the unit
 *  circle, and numeric root-finding scatters an m-fold root by ~ε^(1/m) — for a
 *  realified 6×6 (m up to 6) that is ≈3e-3, ABOVE the default 1.001 floor, so a
 *  parabolic can masquerade as loxodromic. Families whose actions realify to
 *  larger matrices raise `expand` past the scatter (any word with true |λ|
 *  above the floor is still found; near-cusp groups just seed from a longer,
 *  more expanding word). */
export interface CriterionOpts { expand?: number; iso?: number; }

/** A single real isolated dominant eigenvalue, |λ| > 1. The condition for real
 *  power iteration to converge to a fixed direction. */
export function makeRealDominantCriterion(
  { expand = EXPAND, iso = ISO }: CriterionOpts = {},
): LoxodromicCriterion {
  return (eigs) => {
    const top = eigs[0], next = eigs[1];
    const mag = cAbs(top);
    if (mag < expand) return null;
    if (Math.abs(top.im) > REAL * mag) return null;        // dominant must be real
    if (next && cAbs(next) > mag * (1 - iso)) return null;  // dominant must be isolated
    return mag;
  };
}
export const realDominantCriterion: LoxodromicCriterion = makeRealDominantCriterion();

/** Dominant modulus > 1, isolated from the next distinct modulus, with at most a
 *  conjugate pair at the top. For complex (Möbius-type) actions. */
export function makeComplexDominantCriterion(
  { expand = EXPAND, iso = ISO }: CriterionOpts = {},
): LoxodromicCriterion {
  return (eigs) => {
    const mag = cAbs(eigs[0]);
    if (mag < expand) return null;
    let k = 1;
    while (k < eigs.length && cAbs(eigs[k]) > mag * (1 - iso)) k++;
    if (k > 2 || k === eigs.length) return null; // degenerate top cluster / all equal modulus
    return mag;
  };
}
export const complexDominantCriterion: LoxodromicCriterion = makeComplexDominantCriterion();

// ─── Word enumeration + search ───────────────────────────────────────────────

/** Non-backtracking words of EXACTLY `len` letters over the action's alphabet
 *  (never g followed by g⁻¹, using `action.inverse`). */
function* wordsOfLength(action: GroupAction, len: number): Generator<number[]> {
  const { numGenerators, inverse } = action;
  const stack: number[] = [];
  function* rec(): Generator<number[]> {
    if (stack.length === len) { yield stack.slice(); return; }
    const last = stack.length > 0 ? stack[stack.length - 1] : -1;
    for (let g = 0; g < numGenerators; g++) {
      if (last >= 0 && g === inverse[last]) continue;
      stack.push(g);
      yield* rec();
      stack.pop();
    }
  }
  yield* rec();
}

export interface LoxodromicWord {
  word: number[];     // apply-order generator codes
  lambdaMax: number;  // |λ| of the dominant eigenvalue
}

/**
 * Shortest loxodromic word for `action` under `criterion`; among words of equal
 * length the strongest (largest |λ|) wins. Returns null if none up to `maxLen`.
 *
 * Breadth-first by length with early exit: as soon as some length yields a
 * loxodromic we return the strongest at that length.
 */
export function findLoxodromicWord(
  action: GroupAction,
  { maxLen = 10, criterion = realDominantCriterion }: { maxLen?: number; criterion?: LoxodromicCriterion } = {},
): LoxodromicWord | null {
  for (let len = 1; len <= maxLen; len++) {
    let best: LoxodromicWord | null = null;
    for (const word of wordsOfLength(action, len)) {
      const lam = criterion(wordEigenvalues(action, word));
      if (lam === null) continue;
      if (best === null || lam > best.lambdaMax) best = { word, lambdaMax: lam };
    }
    if (best) return best;
  }
  return null;
}

// ─── Word formatting + one-call seeding ──────────────────────────────────────

const SUP: Record<string, string> = { '0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹' };
const sup = (k: number): string => String(k).split('').map((d) => SUP[d]).join('');

/**
 * Human label for an apply-order word, as the group element (reverse product),
 * with run-length exponents. `labels[g]` names generator code g, e.g.
 * `formatWord([1,0,0], ['T','B','B⁻¹'])` → "B²T".
 */
export function formatWord(word: readonly number[], labels: readonly string[]): string {
  const math = word.slice().reverse();
  let out = '';
  for (let i = 0; i < math.length;) {
    let j = i; while (j < math.length && math[j] === math[i]) j++;
    const run = j - i;
    out += labels[math[i]] + (run > 1 ? sup(run) : '');
    i = j;
  }
  return out;
}

export interface Seed {
  basepoint: Float64Array;
  /** Apply-order generator codes of the seed word. */
  word: number[];
  /** Human label for the word (or a comma-joined code list if no `labels`). */
  name: string;
  lambdaMax: number;
  drift: number;
  /** True if no loxodromic word was found and `fallbackWord` was used. */
  fallback: boolean;
}

/**
 * One-call limit-set seeding: find the shortest certified loxodromic word and
 * power-iterate to its attracting fixed point. If none is found within `maxLen`,
 * fall back to `fallbackWord` (e.g. a parabolic γ) when provided, else throw.
 */
export function seedFromLoxodromic(
  action: GroupAction,
  opts: {
    iters?: number;
    maxLen?: number;
    criterion?: LoxodromicCriterion;
    fallbackWord?: readonly number[];
    labels?: readonly string[];
  } = {},
): Seed {
  const { iters = 400, maxLen = 10, criterion = realDominantCriterion, fallbackWord, labels } = opts;
  const lox = findLoxodromicWord(action, { maxLen, criterion });
  const word: number[] | null = lox ? lox.word : (fallbackWord ? [...fallbackWord] : null);
  if (word === null) {
    throw new Error('seedFromLoxodromic: no loxodromic word found and no fallbackWord provided');
  }
  const r = computeProximalBasepoint(action, word, iters);
  return {
    basepoint: r.basepoint,
    word,
    name: labels ? formatWord(word, labels) : word.join(','),
    lambdaMax: lox ? lox.lambdaMax : r.lambdaMax,
    drift: r.drift,
    fallback: !lox,
  };
}

// ─── Block-sum seeding ───────────────────────────────────────────────────────
//
// A representation assembled as a block sum ρ₀ ⊕ ρ₁ ⊕ … (see `matBlockDiag`)
// preserves each block's coordinate subspace. So the attracting fixed point of a
// proximal element of the SUM lies entirely inside ONE block — whichever has the
// largest dominant eigenvalue — and seeding from it traps the orbit in that
// block's projective subspace, silently redrawing a single factor's limit set.
//
// The fix is to seed block by block: find one word that is proximal in EVERY
// factor, take each factor's attracting fixed point, and JOIN them (concatenate,
// then normalize). The result lies on no block subspace; its orbit accumulates on
// the join of the factors' limit sets, which is the limit set of the sum.
//
// Note the search is genuinely easier this way: a word can be proximal in each
// factor while the SUM is non-proximal (the factors' dominant moduli tie), so the
// per-block criterion succeeds on short words where the sum's fails.

export interface BlockLoxodromicWord {
  /** Apply-order generator codes. */
  word: number[];
  /** |λ_dominant| in each block, in block order. */
  lambdaMax: number[];
  /** Smallest relative spectral gap (|λ₀|−|λ₁|)/|λ₀| over the blocks. */
  minGap: number;
}

/**
 * Shortest word that is loxodromic in EVERY block, under `criterion` applied to
 * each block separately; among words of equal length the one with the largest
 * `minGap` wins (the most robust for power iteration in its weakest factor).
 * All blocks must share one alphabet — same `numGenerators` and `inverse`.
 */
export function findBlockLoxodromicWord(
  blocks: readonly GroupAction[],
  { maxLen = 10, criterion = realDominantCriterion }: { maxLen?: number; criterion?: LoxodromicCriterion } = {},
): BlockLoxodromicWord | null {
  if (blocks.length === 0) throw new Error('findBlockLoxodromicWord: no blocks');
  const k = blocks[0].numGenerators;
  for (const b of blocks) {
    if (b.numGenerators !== k) {
      throw new Error('findBlockLoxodromicWord: blocks must share one alphabet (numGenerators differ)');
    }
    for (let g = 0; g < k; g++) {
      if (b.inverse[g] !== blocks[0].inverse[g]) {
        throw new Error('findBlockLoxodromicWord: blocks must share one alphabet (inverse[] differs)');
      }
    }
  }

  for (let len = 1; len <= maxLen; len++) {
    let best: BlockLoxodromicWord | null = null;
    for (const word of wordsOfLength(blocks[0], len)) {
      const lambdaMax: number[] = [];
      let minGap = Infinity;
      let ok = true;
      for (const b of blocks) {
        const eigs = wordEigenvalues(b, word);
        const lam = criterion(eigs);
        if (lam === null) { ok = false; break; }
        lambdaMax.push(lam);
        const next = eigs.length > 1 ? cAbs(eigs[1]) : 0;
        minGap = Math.min(minGap, (lam - next) / lam);
      }
      if (!ok) continue;
      if (best === null || minGap > best.minGap) best = { word, lambdaMax, minGap };
    }
    if (best) return best;
  }
  return null;
}

/** A {@link Seed} for a block-sum action, with the per-block diagnostics. */
export interface BlockSeed extends Seed {
  /** |λ_dominant| of the seed word in each block. */
  blockLambdaMax: number[];
  /** Power-iteration drift in each block. */
  blockDrift: number[];
  /** Smallest relative spectral gap over the blocks (see BlockLoxodromicWord). */
  minGap: number;
}

/**
 * One-call seeding for a block-sum action: find a word proximal in every block
 * (see {@link findBlockLoxodromicWord}), power-iterate it to the attracting fixed
 * point WITHIN each block, and join those into one unit vector of the ambient
 * space. Each block contributes its unit fixed point, so the join is the
 * balanced point of the fibre over (ξ₊⁰, ξ₊¹, …) — no factor is weighted ahead of
 * another.
 *
 * `blocks` are the factor actions (ρ₀, ρ₁, …), NOT the block-sum action; the
 * returned basepoint has dimension Σ blockᵢ.stateDim, matching the sum.
 * `Seed.lambdaMax` reports the weakest block's |λ| and `Seed.drift` the worst
 * block's drift, so the usual "is this seed good?" checks stay meaningful.
 */
export function seedFromBlockLoxodromic(
  blocks: readonly GroupAction[],
  opts: {
    iters?: number;
    maxLen?: number;
    criterion?: LoxodromicCriterion;
    fallbackWord?: readonly number[];
    labels?: readonly string[];
  } = {},
): BlockSeed {
  const { iters = 400, maxLen = 10, criterion = realDominantCriterion, fallbackWord, labels } = opts;
  const lox = findBlockLoxodromicWord(blocks, { maxLen, criterion });
  const word: number[] | null = lox ? lox.word : (fallbackWord ? [...fallbackWord] : null);
  if (word === null) {
    throw new Error('seedFromBlockLoxodromic: no word loxodromic in every block, and no fallbackWord provided');
  }

  const parts = blocks.map((b) => computeProximalBasepoint(b, word, iters));
  const total = blocks.reduce((s, b) => s + b.stateDim, 0);
  const basepoint = new Float64Array(total);
  let off = 0;
  for (let i = 0; i < blocks.length; i++) {
    basepoint.set(parts[i].basepoint, off);
    off += blocks[i].stateDim;
  }
  let s = 0;
  for (let i = 0; i < total; i++) s += basepoint[i] * basepoint[i];
  if (s > 0) {
    const inv = 1 / Math.sqrt(s);
    for (let i = 0; i < total; i++) basepoint[i] *= inv;
  }

  const blockLambdaMax = lox ? lox.lambdaMax : parts.map((p) => p.lambdaMax);
  const blockDrift = parts.map((p) => p.drift);
  return {
    basepoint,
    word,
    name: labels ? formatWord(word, labels) : word.join(','),
    lambdaMax: Math.min(...blockLambdaMax),
    drift: Math.max(...blockDrift),
    fallback: !lox,
    blockLambdaMax,
    blockDrift,
    minGap: lox ? lox.minGap : 0,
  };
}

/**
 * Seed from an EXPLICIT word — the override counterpart to
 * {@link seedFromLoxodromic}: skip the loxodromic search and power-iterate the
 * given word straight to its proximal fixed point. Use when a specific γ is
 * wanted (e.g. a continuous seed across a live parameter sweep, where the
 * shortest-loxodromic word would jump around). Returns a Seed just like the
 * search path, so callers treat both uniformly.
 */
export function seedFromWord(
  action: GroupAction,
  word: readonly number[],
  opts: { iters?: number; name?: string; labels?: readonly string[] } = {},
): Seed {
  const r = computeProximalBasepoint(action, word, opts.iters ?? 400);
  return {
    basepoint: r.basepoint,
    word: [...word],
    name: opts.name ?? (opts.labels ? formatWord(word, opts.labels) : word.join(',')),
    lambdaMax: r.lambdaMax,
    drift: r.drift,
    fallback: false,
  };
}
