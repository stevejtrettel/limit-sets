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

/** A single real isolated dominant eigenvalue, |λ| > 1. The condition for real
 *  power iteration to converge to a fixed direction. */
export const realDominantCriterion: LoxodromicCriterion = (eigs) => {
  const top = eigs[0], next = eigs[1];
  const mag = cAbs(top);
  if (mag < EXPAND) return null;
  if (Math.abs(top.im) > REAL * mag) return null;        // dominant must be real
  if (next && cAbs(next) > mag * (1 - ISO)) return null;  // dominant must be isolated
  return mag;
};

/** Dominant modulus > 1, isolated from the next distinct modulus, with at most a
 *  conjugate pair at the top. For complex (Möbius-type) actions. */
export const complexDominantCriterion: LoxodromicCriterion = (eigs) => {
  const mag = cAbs(eigs[0]);
  if (mag < EXPAND) return null;
  let k = 1;
  while (k < eigs.length && cAbs(eigs[k]) > mag * (1 - ISO)) k++;
  if (k > 2 || k === eigs.length) return null; // degenerate top cluster / all equal modulus
  return mag;
};

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
