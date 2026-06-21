/**
 * Group-agnostic search for a loxodromic word in a GroupAction.
 *
 * A limit-set basepoint must lie on the limit set; the attracting fixed point of
 * a loxodromic element is such a point, and power iteration finds it. Rather
 * than hand-pick a γ word per group, this module SEARCHES the (non-backtracking)
 * word tree of any GroupAction and returns the shortest word whose spectrum
 * certifies it as loxodromic — tested directly from the characteristic
 * polynomial (Faddeev–LeVerrier) + complex roots (Durand–Kerner), NOT from a
 * power-iteration λ-estimate (a parabolic estimate sits just above 1 at finite
 * iteration counts and fools a threshold test).
 *
 * Everything here works through the `GroupAction` interface alone — the word
 * matrix is built by pushing the standard basis through `action.apply`, and the
 * alphabet/non-backtracking rule come from `action.numGenerators`/`inverse`. So
 * it serves any LINEAR matrix action (o5, sp6, slₙℝ, …).
 *
 * The one axis of variation between families is the loxodromic CRITERION:
 *   - `realDominantCriterion` — a single REAL dominant eigenvalue |λ|>1, which
 *     is exactly the condition for real power iteration to converge to a fixed
 *     direction. Use for the real projective families (o5, sp6, slₙℝ).
 *   - `complexDominantCriterion` — dominant MODULUS isolated, allowing a
 *     conjugate pair at the top. For complex actions (sl2c Möbius, R⁴≅C²),
 *     whose loxodromics carry a rotation. Provided as the extension point; such
 *     families also need a complex basepoint step, so it is not yet wired up.
 */

import type { GroupAction } from './group.ts';

export interface Cx { re: number; im: number; }
const cAbs = (z: Cx): number => Math.hypot(z.re, z.im);

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

/** Monic characteristic-polynomial coeffs [1, c₁, …, cₙ] via Faddeev–LeVerrier. */
export function charPoly(M: number[][]): number[] {
  const n = M.length;
  let Mk: number[][] = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  const c = [1];
  const matmul = (A: number[][], B: number[][]): number[][] => {
    const R: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
    for (let i = 0; i < n; i++) for (let k = 0; k < n; k++) { const a = A[i][k]; if (a) for (let j = 0; j < n; j++) R[i][j] += a * B[k][j]; }
    return R;
  };
  for (let k = 1; k <= n; k++) {
    Mk = matmul(M, Mk);
    let tr = 0; for (let i = 0; i < n; i++) tr += Mk[i][i];
    const ck = -tr / k;
    c.push(ck);
    for (let i = 0; i < n; i++) Mk[i][i] += ck;
  }
  return c;
}

/** Complex roots of a monic real polynomial via Durand–Kerner, sorted by
 *  descending modulus. */
export function polyRoots(coef: number[]): Cx[] {
  const n = coef.length - 1;
  const evalP = (z: Cx): Cx => {
    let r: Cx = { re: coef[0], im: 0 };
    for (let i = 1; i <= n; i++) r = { re: r.re * z.re - r.im * z.im + coef[i], im: r.re * z.im + r.im * z.re };
    return r;
  };
  const z: Cx[] = Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i) / n + 0.4;
    return { re: 0.7 * Math.cos(a), im: 0.7 * Math.sin(a) };
  });
  for (let it = 0; it < 600; it++) {
    let step = 0;
    for (let i = 0; i < n; i++) {
      let d: Cx = { re: 1, im: 0 };
      for (let j = 0; j < n; j++) if (j !== i) {
        const dx = { re: z[i].re - z[j].re, im: z[i].im - z[j].im };
        d = { re: d.re * dx.re - d.im * dx.im, im: d.re * dx.im + d.im * dx.re };
      }
      const p = evalP(z[i]);
      const den = d.re * d.re + d.im * d.im;
      const q = { re: (p.re * d.re + p.im * d.im) / den, im: (p.im * d.re - p.re * d.im) / den };
      z[i] = { re: z[i].re - q.re, im: z[i].im - q.im };
      step = Math.max(step, cAbs(q));
    }
    if (step < 1e-13) break;
  }
  return z.sort((a, b) => cAbs(b) - cAbs(a));
}

/** Eigenvalues of `word` under `action`, sorted by descending modulus. */
export function wordEigenvalues(action: GroupAction, word: readonly number[]): Cx[] {
  return polyRoots(charPoly(wordMatrix(action, word)));
}

// ─── Loxodromic criteria ─────────────────────────────────────────────────────

/** Given eigenvalues sorted by descending modulus, return |λ_dominant| if the
 *  word qualifies as loxodromic-for-seeding, else null. */
export type LoxodromicCriterion = (eigs: Cx[]) => number | null;

const EXPAND = 1.001;   // |λ| must exceed this to count as expanding
const ISO = 1e-4;       // dominant must beat the next modulus by this margin
const REAL = 1e-6;      // |im| < REAL·|λ| counts the dominant as real

/** A single real isolated dominant eigenvalue, |λ| > 1. The condition for real
 *  power iteration to converge to a fixed direction. */
export const realDominantCriterion: LoxodromicCriterion = (eigs) => {
  const top = eigs[0], next = eigs[1];
  const mag = cAbs(top);
  if (mag < EXPAND) return null;
  if (Math.abs(top.im) > REAL * mag) return null;     // dominant must be real
  if (next && cAbs(next) > mag * (1 - ISO)) return null; // dominant must be isolated
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

/** All non-backtracking words of length 1..maxLen over the action's alphabet
 *  (never g followed by g⁻¹, using `action.inverse`). */
function* reducedWords(action: GroupAction, maxLen: number): Generator<number[]> {
  const { numGenerators, inverse } = action;
  const stack: number[] = [];
  function* rec(): Generator<number[]> {
    if (stack.length >= 1) yield stack.slice();
    if (stack.length === maxLen) return;
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
 */
export function findLoxodromicWord(
  action: GroupAction,
  { maxLen = 7, criterion = realDominantCriterion }: { maxLen?: number; criterion?: LoxodromicCriterion } = {},
): LoxodromicWord | null {
  let best: LoxodromicWord | null = null;
  for (const word of reducedWords(action, maxLen)) {
    const lam = criterion(wordEigenvalues(action, word));
    if (lam === null) continue;
    if (best === null
        || word.length < best.word.length
        || (word.length === best.word.length && lam > best.lambdaMax)) {
      best = { word, lambdaMax: lam };
    }
  }
  return best;
}
