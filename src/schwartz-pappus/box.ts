/**
 * Schwartz's marked-box construction in RP².
 *
 * A convex marked box is a convex quadrilateral with two distinguished
 * marked points on opposite edges (paper §4.1, [S0], [S1]):
 *
 *     s ─── t ─── u      top edge: corners s, u with marked point t between
 *     │           │
 *     │           │
 *     a ─── b ─── c      bottom edge: corners a, c with marked point b between
 *
 * Stored as a 6-tuple of P² points in the order (s, t, u, a, b, c).
 * The 4 corners in cyclic order around the quadrilateral are (s, u, c, a)
 * — indices 0, 2, 5, 3.
 *
 * Operations:
 *   initialBox(c, d) — the Pappus initial box M_{c,d} at parameters
 *                      (c, d) ∈ (-1, 1)² \ {(0,0)} (paper §4.2 Fig 4.3).
 *   applyI(M)        — i: swap top↔bottom labels via column permutation
 *                      (s,t,u,a,b,c) ↦ (a,b,c,s,t,u). i² = I. Not used by
 *                      the v1 t/b subdivision but kept for the eventual
 *                      modular-group orbit (the full Z/2 ∗ Z/3 action).
 *   pappusChildren(M)— compute t(M) and b(M) via Pappus's theorem
 *                      (direct projective intersections, no group action).
 *
 * Pappus's theorem (specialized to a marked box). The three intersection
 * points
 *   p₁ = ℓ(s, b) ∩ ℓ(t, a)
 *   p₂ = ℓ(s, c) ∩ ℓ(u, a)
 *   p₃ = ℓ(t, c) ∩ ℓ(u, b)
 * are collinear — they lie on the "Pappus line" splitting M horizontally.
 * The top sub-box t(M) = (s, t, u, p₁, p₂, p₃) shares M's top edge and has
 * the Pappus line as its bottom edge; the bottom sub-box b(M) = (p₁, p₂,
 * p₃, a, b, c) is the mirror. By Pappus, each is strictly nested in M
 * (and t(M) ∪ b(M) covers M's interior).
 *
 * This is the "classical Schwartz" presentation (1993). The other Pappus
 * machinery in this directory (matrices.ts, duality.ts) is the "modern
 * Anosov" presentation — same group, different parametrisation. They
 * agree at b = 1 (Pappus boundary) and parametrise the Anosov interior
 * for b > 1.
 */

export type Vec3 = readonly [number, number, number];

/** A marked box: (s, t, u, a, b, c) — top corners s,u; top mark t between;
 *  bottom corners a,c; bottom mark b between. */
export type MarkedBox = readonly [Vec3, Vec3, Vec3, Vec3, Vec3, Vec3];

/** Corner indices in cyclic order around the quadrilateral. */
export const CORNER_IDX = [0, 2, 5, 3] as const; // s, u, c, a

/** Marked-point indices. */
export const TOP_MARK_IDX    = 1; // t
export const BOTTOM_MARK_IDX = 4; // b

/** The initial marked box M_{c,d} at Pappus parameters (paper §4.2 Fig 4.3). */
export function initialBox(c: number, d: number): MarkedBox {
  return [
    [-1, 1, 0],   // s — top-left corner
    [c,  1, 0],   // t — top marked point
    [ 1, 1, 0],   // u — top-right corner
    [-1, 0, 1],   // a — bottom-left corner
    [d,  0, 1],   // b — bottom marked point
    [ 1, 0, 1],   // c — bottom-right corner
  ];
}

/** i(M) — swap top and bottom halves via column permutation. i² = I. */
export function applyI(M: MarkedBox): MarkedBox {
  return [M[3], M[4], M[5], M[0], M[1], M[2]];
}

/**
 * Cross product. In homogeneous coords, the projective line through two
 * points is their cross product, and the intersection of two lines is
 * also their cross product. Both uses are needed for Pappus intersections.
 */
export function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

/**
 * Compute the t- and b-children of M via Pappus's theorem. See module
 * header for the geometric statement. Direct intersections, no matrix
 * action or template — correctness is exactly Pappus's theorem.
 */
export function pappusChildren(M: MarkedBox): { t: MarkedBox; b: MarkedBox } {
  const s = M[0], topMark = M[1], u = M[2];
  const a = M[3], botMark = M[4], c = M[5];

  const p1 = cross(cross(s,       botMark), cross(topMark, a));      // ℓ(s,b) ∩ ℓ(t,a)
  const p2 = cross(cross(s,       c      ), cross(u,       a));      // ℓ(s,c) ∩ ℓ(u,a)
  const p3 = cross(cross(topMark, c      ), cross(u,       botMark));// ℓ(t,c) ∩ ℓ(u,b)

  return {
    t: [s, topMark, u, p1, p2, p3],
    b: [p1, p2, p3, a, botMark, c],
  };
}
