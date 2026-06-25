/**
 * Dimension-agnostic convex-cone machinery — exact (integer / BigInt).
 *
 * Given the extremal rays of a pointed, full-dimensional cone K = cone(R) ⊂ ℝⁿ
 * (integer coordinates), compute its complete face structure:
 *   • facetsFromRays(R) → the facet covectors F   (K = { x : f·x ≥ 0 ∀ f ∈ F }),
 *     by the double-description method in its dual form;
 *   • coneEdges(R, F)   → the 1-skeleton (adjacent ray pairs), Fukuda's test;
 *   • contains(F, x)    → membership.
 *
 * Inputs are integer, so the whole pipeline is EXACT — no tolerance, no
 * degeneracy guessing. This is `core`: a pure ability, no example data. Specific
 * cones (their rays) live in `examples/`.
 *
 * Duality: the facets of K = cone(R) are the extreme rays of the dual cone
 *   K* = { a : a·r ≥ 0 ∀ r ∈ R },
 * a cone given by the halfspaces a·rᵢ ≥ 0 (one per ray). Computing the extreme
 * rays of a halfspace-presented cone is exactly what double-description does, so
 * one routine (`extremeRays`) does the work, run on the ray matrix.
 */

import type { Mat } from './matrix.ts';
import { matInverse, matDim } from './matrix.ts';

type BVec = bigint[];

// ── exact integer vector helpers ────────────────────────────────────────────

const absB = (x: bigint): bigint => (x < 0n ? -x : x);

function gcdB(a: bigint, b: bigint): bigint {
  a = absB(a); b = absB(b);
  while (b) { const t = a % b; a = b; b = t; }
  return a;
}

const dotB = (a: BVec, b: BVec): bigint => {
  let s = 0n;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
};

/** Divide a vector by the gcd of its entries (keeps direction + sign). */
function primitive(v: BVec): BVec {
  let g = 0n;
  for (const x of v) g = gcdB(g, x);
  return g === 0n || g === 1n ? v.slice() : v.map((x) => x / g);
}

/** Canonical form for set-comparison: primitive, first nonzero entry positive. */
function canonical(v: BVec): string {
  const p = primitive(v);
  let lead = 0n;
  for (const x of p) { if (x !== 0n) { lead = x; break; } }
  const s = lead < 0n ? p.map((x) => -x) : p;
  return s.join(',');
}

// ── exact integer linear algebra (Bareiss, fraction-free) ────────────────────

/** Exact determinant of an n×n integer matrix (fraction-free Bareiss). */
function detBareiss(rows: BVec[]): bigint {
  const n = rows.length;
  const a = rows.map((r) => r.slice());
  let sign = 1n, prev = 1n;
  for (let k = 0; k < n - 1; k++) {
    if (a[k][k] === 0n) {
      let sw = -1;
      for (let i = k + 1; i < n; i++) if (a[i][k] !== 0n) { sw = i; break; }
      if (sw < 0) return 0n;
      [a[k], a[sw]] = [a[sw], a[k]];
      sign = -sign;
    }
    for (let i = k + 1; i < n; i++) {
      for (let j = k + 1; j < n; j++) {
        a[i][j] = (a[i][j] * a[k][k] - a[i][k] * a[k][j]) / prev; // exact
      }
      a[i][k] = 0n;
    }
    prev = a[k][k];
  }
  return sign * a[n - 1][n - 1];
}

/** Minor: determinant of `rows` with row `dr` and column `dc` removed. */
function minor(rows: BVec[], dr: number, dc: number): bigint {
  const n = rows.length;
  const sub: BVec[] = [];
  for (let i = 0; i < n; i++) {
    if (i === dr) continue;
    const r: BVec = [];
    for (let j = 0; j < n; j++) if (j !== dc) r.push(rows[i][j]);
    sub.push(r);
  }
  return detBareiss(sub);
}

/** Greedily choose `dim` indices of `vecs` that are linearly independent. */
function independentIndices(vecs: readonly (readonly number[])[], dim: number): number[] {
  const chosen: number[] = [];
  const basis: number[][] = []; // row-reduced float pivots
  for (let i = 0; i < vecs.length && chosen.length < dim; i++) {
    const v = vecs[i].slice();
    for (const b of basis) {
      const p = b.findIndex((x) => Math.abs(x) > 1e-9);
      if (p >= 0 && Math.abs(v[p]) > 1e-12) {
        const f = v[p] / b[p];
        for (let j = 0; j < v.length; j++) v[j] -= f * b[j];
      }
    }
    if (v.some((x) => Math.abs(x) > 1e-7)) { basis.push(v); chosen.push(i); }
  }
  return chosen;
}

// ── double description (extreme rays of { x : Hx ≥ 0 }, H integer) ────────────

interface Gen { v: BVec; Z: bigint } // generator + bitmask of tight halfspaces

/**
 * Extreme rays of the cone { x ∈ ℝᵈ : hᵢ·x ≥ 0 } for integer halfspace normals
 * `H`. Assumes the cone is pointed and full-dimensional. Returns primitive
 * integer ray vectors.
 */
function extremeRays(H: readonly (readonly number[])[], dim: number): BVec[] {
  const HB: BVec[] = H.map((h) => h.map((x) => BigInt(x)));
  const m = HB.length;

  // 1. Initialise from `dim` independent halfspaces B: the extreme rays of
  //    { x : Bx ≥ 0 } are the columns of adj(B) signed by det(B); column k is
  //    tight on every chosen halfspace except k.
  const basisIdx = independentIndices(H, dim);
  if (basisIdx.length < dim) throw new Error('convex: rays do not span ℝⁿ (cone not full-dimensional)');
  const B = basisIdx.map((i) => HB[i]);
  const det = detBareiss(B);
  if (det === 0n) throw new Error('convex: degenerate initial basis');
  const sgn = det < 0n ? -1n : 1n;

  let gens: Gen[] = [];
  for (let k = 0; k < dim; k++) {
    // column k of adj(B): entry i = cofactor C_{ki} = (-1)^{k+i} minor(B; row k, col i)
    const col: BVec = new Array(dim);
    for (let i = 0; i < dim; i++) {
      const c = (((k + i) & 1) ? -1n : 1n) * minor(B, k, i);
      col[i] = sgn * c;
    }
    let Z = 0n;
    for (let i = 0; i < dim; i++) if (i !== k) Z |= 1n << BigInt(basisIdx[i]);
    gens.push({ v: primitive(col), Z });
  }

  // 2. Insert every remaining halfspace incrementally. `processed` is the set of
  //    halfspaces enforced so far (basis + everything inserted); we use it to
  //    recompute each new ray's COMPLETE active set (a maintained `common|bit`
  //    misses accidental tangencies, which shrinks `common` and over-vetoes).
  const inBasis = new Set(basisIdx);
  const processed: number[] = [...basisIdx];

  const dedupe = (arr: Gen[]): Gen[] => {
    const seen = new Map<string, Gen>();
    for (const g of arr) {
      const k = canonical(g.v);
      const e = seen.get(k);
      if (e) e.Z |= g.Z; else seen.set(k, g);
    }
    return [...seen.values()];
  };

  for (let aIdx = 0; aIdx < m; aIdx++) {
    if (inBasis.has(aIdx)) continue;
    const a = HB[aIdx];
    const bit = 1n << BigInt(aIdx);

    const pos: Gen[] = [], zero: Gen[] = [], neg: Gen[] = [];
    const sVal = new Map<Gen, bigint>();
    for (const g of gens) {
      const s = dotB(g.v, a);
      sVal.set(g, s);
      if (s > 0n) pos.push(g);
      else if (s < 0n) neg.push(g);
      else zero.push(g);
    }

    // zero-side generators become tight on this halfspace
    for (const g of zero) g.Z |= bit;

    if (neg.length === 0) { processed.push(aIdx); continue; } // redundant here

    const next: Gen[] = [...pos, ...zero];
    for (const p of pos) {
      for (const n of neg) {
        const common = p.Z & n.Z;
        // Fukuda combinatorial adjacency: with complete active sets and a deduped
        // (non-redundant) generator set, p and n are adjacent ⟺ no OTHER current
        // generator is tight on every halfspace common to both. (The algebraic
        // test — rank of the common halfspaces = dim−2 — is the slower fallback.)
        let adjacent = true;
        for (const g of gens) {
          if (g === p || g === n) continue;
          if ((g.Z & common) === common) { adjacent = false; break; }
        }
        if (!adjacent) continue;
        const sp = sVal.get(p)!, sn = sVal.get(n)!; // sn < 0
        const nv: BVec = new Array(a.length);
        for (let i = 0; i < a.length; i++) nv[i] = sp * n.v[i] - sn * p.v[i];
        const pv = primitive(nv);
        // complete active set: every processed halfspace this ray is tight on
        let Z = bit; // tight on aIdx by construction
        for (const h of processed) if (dotB(pv, HB[h]) === 0n) Z |= 1n << BigInt(h);
        next.push({ v: pv, Z });
      }
    }
    gens = dedupe(next);
    processed.push(aIdx);
  }

  return gens.map((g) => g.v);
}

// ── public API ───────────────────────────────────────────────────────────────

export interface ConvexCone {
  /** Extremal rays (the given generators), as plain number vectors in ℝⁿ. */
  readonly rays: readonly (readonly number[])[];
  /** Facet covectors: K = { x : f·x ≥ 0 ∀ f }. Primitive integer vectors. */
  readonly facets: readonly (readonly number[])[];
  /** 1-skeleton: adjacent ray index pairs [i, j], i < j. */
  readonly edges: readonly [number, number][];
  /** Ambient dimension n. */
  readonly dim: number;
}

/**
 * Facet covectors of K = cone(rays), via double description on the dual cone.
 * `rays` must be integer-valued; returns primitive integer covectors (one per
 * facet, deduplicated), with K = { x : f·x ≥ 0 }.
 */
export function facetsFromRays(rays: readonly (readonly number[])[]): number[][] {
  if (rays.length === 0) return [];
  const dim = rays[0].length;
  const raw = extremeRays(rays, dim);
  const seen = new Set<string>();
  const out: number[][] = [];
  for (const f of raw) {
    const key = canonical(f);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(primitive(f).map(Number));
  }
  return out;
}

/**
 * 1-skeleton of cone(rays) given its facets: rays i, j are joined by an edge iff
 * the smallest face containing both is the 2-face they span — i.e. exactly two
 * rays are tight on every facet common to i and j (Fukuda's adjacency test).
 * Integer inputs ⇒ the incidence test f·r = 0 is exact.
 */
export function coneEdges(
  rays: readonly (readonly number[])[],
  facets: readonly (readonly number[])[],
): [number, number][] {
  const n = rays.length;
  // active-facet bitmask per ray
  const A: bigint[] = rays.map((r) => {
    let mask = 0n;
    for (let f = 0; f < facets.length; f++) {
      let d = 0;
      const h = facets[f];
      for (let j = 0; j < h.length; j++) d += h[j] * r[j];
      if (d === 0) mask |= 1n << BigInt(f);
    }
    return mask;
  });
  const edges: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const common = A[i] & A[j];
      if (common === 0n) continue;
      let count = 0;
      for (let k = 0; k < n; k++) {
        if ((A[k] & common) === common && ++count > 2) break;
      }
      if (count === 2) edges.push([i, j]);
    }
  }
  return edges;
}

/** Build the full face structure of K = cone(rays) from its generators alone. */
export function coneFromRays(rays: readonly (readonly number[])[]): ConvexCone {
  const facets = facetsFromRays(rays);
  const edges = coneEdges(rays, facets);
  return { rays, facets, edges, dim: rays.length ? rays[0].length : 0 };
}

/** Membership: x ∈ K ⟺ f·x ≥ 0 for every facet covector f. */
export function contains(
  facets: readonly (readonly number[])[],
  x: readonly number[],
  eps = 0,
): boolean {
  for (const f of facets) {
    let d = 0;
    for (let j = 0; j < f.length; j++) d += f[j] * x[j];
    if (d < -eps) return false;
  }
  return true;
}

/**
 * The image cone g·K. Rays map by `M` (columns); facet covectors map by the
 * inverse-transpose so that (M⁻ᵀf)·(Mr) = f·r is preserved. Edges are invariant
 * (a linear iso preserves the face lattice), so they carry over unchanged.
 */
export function transformCone(cone: ConvexCone, M: Mat): ConvexCone {
  const n = matDim(M);
  const Minv = matInverse(M);
  const apply = (v: readonly number[]): number[] => {
    const out = new Array(n).fill(0);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) out[i] += M[i * n + j] * v[j];
    return out;
  };
  const applyInvT = (v: readonly number[]): number[] => {
    const out = new Array(n).fill(0);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) out[i] += Minv[j * n + i] * v[j];
    return out;
  };
  return {
    rays: cone.rays.map(apply),
    facets: cone.facets.map(applyInvT),
    edges: cone.edges,
    dim: cone.dim,
  };
}
