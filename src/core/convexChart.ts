/**
 * The AFFINE PICTURE of a convex cone in a projective chart — including the case
 * where the cone runs through the chart's hyperplane at infinity.
 *
 * A chart π(x) = (R·x)/(d·x) shows a cone K ⊂ ℝⁿ as a bounded convex body only
 * when d·x is one-signed on K. Otherwise ℙ(K) meets the hyperplane at infinity
 * and its affine picture is TWO unbounded convex pieces racing off in opposite
 * directions — which is the honest picture, not a failure to be skipped.
 *
 * Splitting the rays by the sign of d gives those pieces explicitly:
 *
 *   half⁺ = conv{ π(rᵢ) : d·rᵢ > 0 } + cone{ π(rᵢ) − π(rⱼ) : d·rᵢ > 0 > d·rⱼ }
 *   half⁻ = conv{ π(rⱼ) : d·rⱼ < 0 } + cone{ π(rⱼ) − π(rᵢ) }   (the same
 *                                                               directions, negated)
 *
 * — a segment from rᵢ to rⱼ crosses d = 0 exactly once, and its image escapes
 * along π(rᵢ) − π(rⱼ), one way on each side.
 *
 * Rather than assemble that in ℝ³, this module cuts it in ℝⁿ, where it stays
 * exact. Truncating the picture to a box |π(x)_a| ≤ M is, on the side where
 * d·x > 0, the LINEAR condition M(d·x) ∓ R_a·x ≥ 0. So each visible half is the
 * cone K cut by 1 + 6 extra halfspaces, and its corners are the extreme rays of
 * that — `raysFromHalfspaces`, exactly, in integer arithmetic.
 *
 * The cone's facets must therefore be exact integers (as `coneFromRays` gives).
 * The CHART covectors are rounded onto a fine rational grid: they only place the
 * split plane and the truncation box, and being off by 1e-6 there moves the cut
 * only in the far field, which is off-screen by construction.
 *
 * Generic: any cone, any chart, any dimension. No group data.
 */

import { raysFromHalfspaces, type ConvexCone } from './convex.ts';
import type { SceneEmbedding } from './scene.ts';
import type { Hull3 } from './hull3.ts';

export interface ChartCovectors {
  /** The chart's denominator covector d (length n). */
  readonly denom: readonly number[];
  /** The chart's numerator rows R (each length n). */
  readonly rows: readonly (readonly number[])[];
}

export interface ChartPiece {
  /** Rays of the sub-cone whose chart image is this piece. */
  readonly rays: readonly (readonly number[])[];
  /** Sign of d on this piece: +1 or −1. */
  readonly sign: 1 | -1;
  /** True when the piece was truncated (the cone runs to infinity here). */
  readonly clipped: boolean;
}

export interface ConeChartOptions {
  /**
   * Truncation half-width M, in chart units: an unbounded half is cut at
   * |π(x)_a| ≤ M. Make it comfortably larger than the frame so the cut edge
   * falls outside the picture and the piece reads as running off, not as ending.
   */
  extent?: number;
  /** Grid the chart covectors are rounded onto. Default 1e6. */
  precision?: number;
  /** Relative tolerance for "d·r is zero". Default 1e-12. */
  eps?: number;
}

/**
 * Push a list of rays through a scene embedding. `null` marks a ray the chart
 * sends to infinity. (Shared by the viewer, the offline renderer, and the
 * extent heuristic, so they all see the same points.)
 */
export function embedRays(
  rays: readonly (readonly number[])[],
  embedding: SceneEmbedding,
): ([number, number, number] | null)[] {
  const buf = new Float64Array(embedding.stateDim);
  const out = new Float64Array(3);
  return rays.map((r) => {
    for (let j = 0; j < buf.length; j++) buf[j] = r[j];
    return embedding.embed(buf, 0, out, 0) ? [out[0], out[1], out[2]] : null;
  });
}

/**
 * Which faces of a truncated piece's hull lie ON the truncation box — the flat
 * lids the cut left behind, not boundary of the domain.
 *
 * The cut planes are M(d·x) ∓ R_a·x = 0, which in the chart is π_a = ±M: an
 * AXIS-ALIGNED coordinate plane. So a lid is exactly a hull face whose normal is
 * a coordinate direction at offset M. Dropping these leaves the body open where
 * it was cut, which is what makes a half read as running off to infinity instead
 * of ending at a wall.
 */
export function clipBoxFaces(hull: Hull3, extent: number, tol = 1e-3): Set<number> {
  const lids = new Set<number>();
  if (!(extent > 0)) return lids;
  const slack = tol * extent;
  hull.faces.forEach((f, i) => {
    for (let a = 0; a < 3; a++) {
      if (Math.abs(Math.abs(f.normal[a]) - 1) < tol && Math.abs(Math.abs(f.offset) - extent) < slack) {
        lids.add(i);
        return;
      }
    }
  });
  return lids;
}

/** Hull vertices that survive once `hidden` faces are dropped. */
export function facesToVertices(hull: Hull3, hidden: ReadonlySet<number>): Set<number> {
  const keep = new Set<number>();
  hull.faces.forEach((f, i) => { if (!hidden.has(i)) for (const v of f.loop) keep.add(v); });
  return keep;
}

const dot = (a: readonly number[], b: readonly number[]): number => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
};

const norm = (a: readonly number[]): number => Math.hypot(...a);

/**
 * The drawable pieces of `cone` in the chart given by `view`.
 *
 * One piece, unclipped, when the cone is bounded in this chart — the cone
 * itself, untouched. Two pieces, both truncated to `extent`, when it crosses
 * infinity. Empty if the geometry degenerates (the caller should then draw
 * nothing rather than draw something wrong).
 */
export function coneChartPieces(
  cone: ConvexCone,
  view: ChartCovectors,
  opts: ConeChartOptions = {},
): ChartPiece[] {
  const extent = opts.extent ?? 100;
  const S = opts.precision ?? 1e6;
  const eps = opts.eps ?? 1e-12;
  const d = view.denom;

  // Bounded? Then there is nothing to split: one piece, exactly the cone.
  const dn = norm(d);
  let lo = Infinity, hi = -Infinity;
  for (const r of cone.rays) {
    const s = dot(d, r) / (dn * norm(r) || 1);
    if (s < lo) lo = s;
    if (s > hi) hi = s;
  }
  if (lo > eps) return [{ rays: cone.rays, sign: 1, clipped: false }];
  if (hi < -eps) return [{ rays: cone.rays, sign: -1, clipped: false }];

  // Crossing. Round the chart onto an integer grid; the cone's own facets are
  // already exact and are used verbatim.
  const dI = d.map((v) => Math.round(v * S));
  const RI = view.rows.map((row) => row.map((v) => Math.round(v * S)));
  const q = 1024;                              // extent as the rational p/q
  const p = Math.max(1, Math.round(extent * q));
  if (dI.every((v) => v === 0)) return [];

  const pieces: ChartPiece[] = [];
  for (const sign of [1, -1] as const) {
    // K ∩ { sign·d·x ≥ 0 } ∩ { M(sign·d·x) ∓ R_a·x ≥ 0 }
    const H: number[][] = cone.facets.map((f) => f.map(Number));
    const sd = dI.map((v) => sign * v);
    H.push(sd);
    for (const row of RI) {
      H.push(sd.map((v, i) => p * v - q * row[i]));
      H.push(sd.map((v, i) => p * v + q * row[i]));
    }
    try {
      const rays = raysFromHalfspaces(H);
      if (rays.length >= 3) pieces.push({ rays, sign, clipped: true });
    } catch {
      /* this half degenerates in this chart — leave it out */
    }
  }
  return pieces;
}
