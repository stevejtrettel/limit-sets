/**
 * Color schemes: declarative descriptors that assign each orbit point a
 * category index in [0, K).
 *
 * A scheme is a tiny object:
 *   {
 *     name: string,            // identifier ("grayscale", "last-gen", ...)
 *     categoryCount: number,   // K — total number of categories
 *     stepsBack: number,       // -1 = grayscale (no per-point lookup);
 *                              //  0 = last letter (lastGen of current node)
 *                              //  k = (k+1)-th-to-last letter
 *   }
 *
 * Category 0 is reserved for "default / uncategorized" — typically the
 * basepoint, or any node whose word is shorter than the scheme requires.
 * For last-letter-family schemes:
 *   cat 0 = basepoint / underflow
 *   cat 1..4 = generators (A, A⁻¹, B, B⁻¹), i.e. lastGen value + 1.
 *
 * Why a declarative descriptor rather than a `getCategory(history)` callback?
 * The DFS hot loop hits >10⁸ nodes; even a tiny per-node closure allocation
 * adds noticeable overhead. Each consumer (offline DFS, browser orbit walker)
 * inlines the category lookup using `stepsBack` directly, and uses its own
 * data structure (lastGenStack vs orbit.parents) without an abstraction
 * boundary. Schemes still share the registry, so K and the category numbering
 * agree across both consumers.
 *
 * Built-in schemes:
 *   - "grayscale"         K=1   stepsBack=-1
 *   - "last-gen"          K=5   stepsBack=0
 *   - "kth-last:K"        K=5   stepsBack=K-1
 */

export interface ColorScheme {
  readonly name: string;
  readonly categoryCount: number;
  /** -1 = grayscale (no lookup); 0 = last letter; k = (k+1)-th to last. */
  readonly stepsBack: number;
}

const grayscaleScheme: ColorScheme = Object.freeze({
  name: 'grayscale',
  categoryCount: 1,
  stepsBack: -1,
});

/** Construct or look up a scheme by spec string. */
export function getScheme(spec: string): ColorScheme {
  if (spec === 'grayscale') return grayscaleScheme;
  if (spec === 'last-gen') {
    return Object.freeze({ name: 'last-gen', categoryCount: 5, stepsBack: 0 });
  }
  if (spec.startsWith('kth-last:')) {
    const k = parseInt(spec.slice('kth-last:'.length), 10);
    if (!Number.isFinite(k) || k < 1) {
      throw new Error(`invalid kth-last spec '${spec}': k must be ≥ 1`);
    }
    return Object.freeze({ name: spec, categoryCount: 5, stepsBack: k - 1 });
  }
  throw new Error(`unknown color scheme '${spec}'`);
}

/**
 * Translate the browser's existing numeric "color-depth" UI value (0..N) to
 * a scheme. Kept so the dropdown's muscle memory stays intact.
 *
 *   0 → grayscale
 *   1 → last-gen
 *   k ≥ 2 → kth-last:k
 */
export function schemeForColorDepth(colorDepth: number): ColorScheme {
  if (colorDepth <= 0) return getScheme('grayscale');
  if (colorDepth === 1) return getScheme('last-gen');
  return getScheme(`kth-last:${colorDepth}`);
}

// ─── Lookup helpers ─────────────────────────────────────────────────────────
//
// Use inline if the hot path needs to be tight; these exist for callers
// who don't want to hand-roll the same logic.

/**
 * Category for an offline-DFS node, given the scheme's stepsBack.
 *
 * @param stepsBack       scheme.stepsBack (≥ 0 for last-letter schemes)
 * @param depth           current node depth (0 = basepoint)
 * @param lastGenStack    lastGenStack[d] is generator at depth d;
 *                        [0] is sentinel 255 for the basepoint
 */
export function categoryFromStack(
  stepsBack: number,
  depth: number,
  lastGenStack: Uint8Array,
): number {
  const d = depth - stepsBack;
  if (d < 1) return 0;
  const g = lastGenStack[d];
  if (g > 3) return 0;
  return g + 1;
}

/**
 * Category for a browser-orbit node, given the scheme's stepsBack and the
 * flat orbit data structure (lastGen[] + parents[]).
 */
export function categoryFromOrbit(
  stepsBack: number,
  lastGen: Uint8Array,
  parents: Uint32Array,
  idx: number,
): number {
  let cur = idx;
  for (let i = 0; i < stepsBack; i++) {
    if (lastGen[cur] === 255) return 0;
    cur = parents[cur];
  }
  const g = lastGen[cur];
  if (g === 255 || g > 3) return 0;
  return g + 1;
}
