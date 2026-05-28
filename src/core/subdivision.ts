/**
 * Generic n-ary subdivision-tree walker.
 *
 * Companion to `generateOrbit` in [./orbit.ts](./orbit.ts), which walks a
 * non-backtracking word tree in a group with inverses (the right model for
 * point-cloud limit sets via matrix actions). `subdivideTree` is for the
 * other shape: a recursion where each state has a fixed set of children
 * (no group structure, no inverses), so the orbit is a literal n-ary tree.
 *
 * Examples this fits:
 *   - Schwartz / Pappus marked-box subdivision (each box has 2 children
 *     t(M), b(M) via Pappus's theorem; see src/schwartz-pappus/box.ts).
 *   - Apollonian gasket (each curvilinear triangle has 3 sub-triangles).
 *   - Iterated function systems (each state branches into N transformed
 *     copies of itself).
 *   - Hyperbolic / spherical tessellation building.
 *
 * The walker is intentionally minimal: it doesn't know about groups,
 * inverses, or projective space — it's just `recurse(state, depth)` over
 * an arbitrary `children` callback. Pair with a domain-specific renderer
 * to draw whatever the states are (line segments, triangles, circles…).
 */

export interface DepthState<S> {
  state: S;
  depth: number;
}

/**
 * Walk the subdivision tree rooted at `initial`. Emits every visited
 * node (root + all descendants up to `maxDepth`) as `{state, depth}` in
 * DFS pre-order. `maxDepth = 0` emits only the root.
 *
 * Number of emitted nodes for a uniform n-ary tree of depth N:
 *   1 + n + n² + ... + n^N = (n^(N+1) - 1) / (n - 1)
 * (n = 2: 2^(N+1) - 1; n = 3: (3^(N+1) - 1)/2; etc.)
 */
export function subdivideTree<S>(
  initial: S,
  children: (s: S) => readonly S[],
  maxDepth: number,
): DepthState<S>[] {
  const out: DepthState<S>[] = [];
  function recurse(s: S, depth: number): void {
    out.push({ state: s, depth });
    if (depth >= maxDepth) return;
    for (const c of children(s)) recurse(c, depth + 1);
  }
  recurse(initial, 0);
  return out;
}
