/**
 * Group-agnostic orbit walkers.
 *
 *   generateOrbit             — BFS up to depth N; stores every visited state.
 *   streamOrbit               — DFS up to depth N; emits states via callback,
 *                               memory O(depth), never holds the orbit.
 *   computeProximalBasepoint  — power-iterate a γ word to find ξ₊(γ).
 *
 * Both walkers traverse the *non-backtracking* word tree (no edge g · g⁻¹ is
 * ever taken). The basepoint stores `BASEPOINT_SENTINEL` (255) in its
 * `lastGen` slot; downstream consumers detect it with `lastGen < numGen`.
 *
 * Matrices are not tracked here — that's "ball mode", a separate path. This
 * file is the hot loop for streaming renders and live previews; it stays
 * lean and matrix-free on purpose.
 */

import type { GroupAction } from './group.ts';

export const BASEPOINT_SENTINEL = 255;

export interface Orbit {
  /** Dimension of each state vector (matches the producing GroupAction). */
  stateDim: number;
  /** stateDim · count, contiguous. */
  vecs:    Float64Array;
  /** count; generator that produced this node (255 = basepoint). */
  lastGen: Uint8Array;
  /** count; BFS parent index (basepoint stores 0). */
  parents: Uint32Array;
  count:   number;
}

/**
 * Total nodes in the non-backtracking word tree up to depth N:
 *   1 + Σ_{d=1..N} k · (k−1)^(d−1)
 * where k = numGenerators. Computed iteratively to dodge the k=2 division.
 */
export function totalNodes(numGenerators: number, N: number): number {
  if (N < 0) return 0;
  let total = 1;
  let layer = numGenerators; // count at depth 1
  for (let d = 1; d <= N; d++) {
    total += layer;
    layer *= numGenerators - 1;
  }
  return total;
}

/**
 * BFS up to depth N. Every visited state is kept in `vecs`, indexed by BFS
 * order. Use this when downstream code needs random-access to the orbit
 * (live preview, PCA fit, ball→orbit projection).
 */
export function generateOrbit(
  action: GroupAction,
  basepoint: Float64Array,
  N: number,
): Orbit {
  const { numGenerators, stateDim, inverse } = action;
  const total = totalNodes(numGenerators, N);
  const vecs = new Float64Array(total * stateDim);
  const lastGen = new Uint8Array(total);
  const parents = new Uint32Array(total);

  for (let i = 0; i < stateDim; i++) vecs[i] = basepoint[i];
  lastGen[0] = BASEPOINT_SENTINEL;
  parents[0] = 0; // never read; we stop at lastGen == BASEPOINT_SENTINEL.

  let parentStart = 0;
  let parentEnd = 1;
  let writeIdx = 1;

  for (let d = 1; d <= N; d++) {
    for (let p = parentStart; p < parentEnd; p++) {
      const pLast = lastGen[p];
      const pOff = p * stateDim;
      for (let g = 0; g < numGenerators; g++) {
        if (pLast < numGenerators && g === inverse[pLast]) continue;
        const wOff = writeIdx * stateDim;
        action.apply(g, vecs, pOff, vecs, wOff);
        if (action.normalize) action.normalize(vecs, wOff);
        lastGen[writeIdx] = g;
        parents[writeIdx] = p;
        writeIdx++;
      }
    }
    parentStart = parentEnd;
    parentEnd = writeIdx;
  }

  return { stateDim, vecs, lastGen, parents, count: writeIdx };
}

/**
 * Streaming DFS up to depth N. `onNode` fires once per visited node
 * (including the basepoint at depth 0). Memory = O((N+1)·stateDim) — flat
 * scratch buffer plus two N+1 byte stacks.
 *
 * `lastGenStack[d]` is the generator that produced the node currently at
 * depth d; `lastGenStack[0] = 255` is the basepoint sentinel. Callbacks
 * that need the k-th-to-last letter read `lastGenStack[depth - k]`.
 */
export type StreamCallback = (
  vecs:         Float64Array,
  off:          number,
  depth:        number,
  lastGenStack: Uint8Array,
) => void;

export function streamOrbit(
  action: GroupAction,
  basepoint: Float64Array,
  N: number,
  onNode: StreamCallback,
): void {
  const { numGenerators, stateDim, inverse } = action;
  const vecs = new Float64Array((N + 1) * stateDim);
  const lastGenStack = new Uint8Array(N + 1);
  const childStack   = new Uint8Array(N + 1);
  for (let i = 0; i < stateDim; i++) vecs[i] = basepoint[i];
  lastGenStack[0] = BASEPOINT_SENTINEL;
  childStack[0]   = 0;

  onNode(vecs, 0, 0, lastGenStack);

  let d = 0;
  while (d >= 0) {
    if (d >= N) { d--; continue; }
    const pLast = lastGenStack[d];
    let g = childStack[d];
    while (g < numGenerators && pLast < numGenerators && g === inverse[pLast]) g++;
    if (g >= numGenerators) { d--; continue; }
    childStack[d] = g + 1;
    const dOff = (d + 1) * stateDim;
    action.apply(g, vecs, d * stateDim, vecs, dOff);
    if (action.normalize) action.normalize(vecs, dOff);
    d++;
    lastGenStack[d] = g;
    childStack[d]   = 0;
    onNode(vecs, dOff, d, lastGenStack);
  }
}

// ─── Proximal basepoint via power iteration ─────────────────────────────────

export interface ProximalBasepoint {
  basepoint: Float64Array;
  /** Operator norm of γ after the final iterate (informative iff normalize is set). */
  lambdaMax: number;
  /** Distance from one more normalized γ-step to the fixed iterate. */
  drift:     number;
}

function applyWord(
  action: GroupAction,
  word: readonly number[],
  buf: Float64Array,
): void {
  for (let i = 0; i < word.length; i++) {
    action.apply(word[i], buf, 0, buf, 0);
  }
}

/**
 * Deterministic seed with mixed signs and irrational-looking magnitudes.
 * Power iteration converges to the dominant eigendirection only if the seed has
 * a nonzero component along it; a generic (non-axis-aligned) vector ensures that
 * for essentially any γ. Replaceable via the `seed` parameter on
 * `computeProximalBasepoint`.
 */
function defaultSeed(stateDim: number): Float64Array {
  const v = new Float64Array(stateDim);
  for (let i = 0; i < stateDim; i++) {
    v[i] = Math.sin((i + 1) * 1.732 + 0.41);
  }
  return v;
}

/**
 * Power-iterate `word` (a sequence of generator codes) starting from
 * `seed` (or the default seed if omitted). After `iterations` rounds, the
 * iterate is the proximal fixed point ξ₊ of γ. `lambdaMax` and `drift`
 * are diagnostics; see ProximalBasepoint.
 */
export function computeProximalBasepoint(
  action: GroupAction,
  word: readonly number[],
  iterations: number,
  seed?: Float64Array,
): ProximalBasepoint {
  const { stateDim } = action;
  const v = seed ? new Float64Array(seed) : defaultSeed(stateDim);
  if (action.normalize) action.normalize(v, 0);

  for (let k = 0; k < iterations; k++) {
    applyWord(action, word, v);
    if (action.normalize) action.normalize(v, 0);
  }

  const tmp = new Float64Array(v);
  applyWord(action, word, tmp);
  let lam2 = 0;
  for (let i = 0; i < stateDim; i++) lam2 += tmp[i] * tmp[i];
  const lambdaMax = Math.sqrt(lam2);

  const tmp2 = new Float64Array(tmp);
  if (action.normalize) action.normalize(tmp2, 0);
  let drift = 0;
  for (let i = 0; i < stateDim; i++) {
    const d = tmp2[i] - v[i];
    drift += d * d;
  }

  return { basepoint: v, lambdaMax, drift: Math.sqrt(drift) };
}
