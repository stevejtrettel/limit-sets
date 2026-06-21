/**
 * Loxodromic seed-finding for O(5) limit sets — a thin o5 wrapper over the
 * group-agnostic search in `@/core/loxodromic`.
 *
 * To draw a limit set we need a basepoint that lies ON it. The attracting fixed
 * point of a loxodromic element (real isolated dominant eigenvalue |λ| > 1) is
 * such a point, and power iteration converges to it crisply. We search the
 * {T,B,B⁻¹} word tree for the shortest such word and seed from it. The naive
 * γ = TB (paper §3) is only a parabolic — or, for the α = (0,1/10,3/10,7/10,9/10)
 * family, an *elliptic* (10th-root-of-unity) — fallback.
 *
 * o5-specific bits live here: the T/B/B⁻¹ labels and the TB fallback. The
 * spectrum machinery and the real-dominant criterion are in the core module.
 *
 * (Future: parabolic fixed points also lie in the limit set; seeding from both a
 * loxodromic and a parabolic point would cover different regions. Not yet.)
 */

import type { GroupAction } from '../core/group.ts';
import { computeProximalBasepoint } from '../core/orbit.ts';
import { findLoxodromicWord as coreFindLoxodromic } from '../core/loxodromic.ts';

const SUP: Record<string, string> = { '0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹' };
const sup = (k: number): string => String(k).split('').map((d) => SUP[d]).join('');

/** Human label for an apply-order o5 word (codes 0=T, 1=B, 2=B⁻¹), as the group
 *  element (reverse product), e.g. [0,1,1] → "B²T", [2,0,2] → "B⁻¹TB⁻¹". */
export function formatWord(applyWord: readonly number[]): string {
  const math = applyWord.slice().reverse();
  let out = '';
  for (let i = 0; i < math.length;) {
    let j = i; while (j < math.length && math[j] === math[i]) j++;
    const run = j - i, g = math[i];
    if (g === 0) out += run === 1 ? 'T' : `T${sup(run)}`;        // T can't actually repeat
    else if (g === 1) out += run === 1 ? 'B' : `B${sup(run)}`;   // Bʳᵘⁿ
    else out += run === 1 ? 'B⁻¹' : `B⁻${sup(run)}`;            // B⁻ʳᵘⁿ
    i = j;
  }
  return out;
}

export interface LoxodromicWord {
  word: number[];     // apply-order generator codes
  name: string;       // human label, e.g. "B²T"
  lambdaMax: number;
}

/** Shortest loxodromic word for the o5 action (or null if none up to maxLen). */
export function findLoxodromicWord(action: GroupAction): LoxodromicWord | null {
  const lox = coreFindLoxodromic(action);
  return lox ? { word: lox.word, name: formatWord(lox.word), lambdaMax: lox.lambdaMax } : null;
}

export interface Seed extends LoxodromicWord {
  basepoint: Float64Array;
  drift: number;
  /** True if we fell back to the parabolic γ = TB (no loxodromic word found). */
  fallback: boolean;
}

/**
 * A limit-set basepoint from the best loxodromic word (or, failing that, the
 * parabolic γ = TB). `iters` is the power-iteration count for the final seed.
 */
export function loxodromicSeed(action: GroupAction, iters = 400): Seed {
  const lox = findLoxodromicWord(action);
  const word = lox ? lox.word : [1, 0]; // [1,0] = TB in apply order
  const r = computeProximalBasepoint(action, word, iters);
  return {
    basepoint: r.basepoint,
    word,
    name: lox ? lox.name : 'TB',
    lambdaMax: lox ? lox.lambdaMax : r.lambdaMax,
    drift: r.drift,
    fallback: !lox,
  };
}
