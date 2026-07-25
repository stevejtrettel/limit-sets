/**
 * Convex hull of a point cloud in ℝ³ — the *silhouette* companion to
 * `core/convex.ts`.
 *
 * `core/convex` computes the EXACT face lattice of a cone in ℝⁿ from integer
 * rays. But a chart ℝⁿ ⇢ ℝ³ is a genuine projection, so the picture of a convex
 * body is its SHADOW: the convex hull of the projected generators. That hull is
 * a floating-point object in ℝ³, and this module computes it:
 *
 *   convexHull3(points) → faces (planar polygons, outward normals),
 *                         edges (with their two incident faces),
 *                         boundary (which inputs lie on the surface).
 *
 * Incremental (quickhull-style) construction, then coplanar triangles are merged
 * into single polygonal faces — so a flat face of the shadow is ONE polygon, not
 * a fan. That matters downstream: seam-free translucent fills, and a silhouette
 * that follows real face boundaries instead of triangulation artifacts.
 *
 * Floating point, so tolerances are relative to the cloud's scale. `hullViolation`
 * reports how far outside the computed hull any input point sits — a residual
 * that should be ~0 and is worth asserting in a gate.
 *
 * Generic ability: no group data, no example constants.
 */

export type Vec3 = readonly [number, number, number];

export interface Hull3Face {
  /** Input indices around the face, CCW seen from OUTSIDE the hull. */
  readonly loop: readonly number[];
  /** Outward unit normal. */
  readonly normal: Vec3;
  /** Plane offset: normal·x = offset for x on this face. */
  readonly offset: number;
}

export interface Hull3Edge {
  readonly a: number;
  readonly b: number;
  /** The two faces meeting along this edge (indices into `faces`). */
  readonly f0: number;
  readonly f1: number;
}

export interface Hull3 {
  readonly faces: readonly Hull3Face[];
  readonly edges: readonly Hull3Edge[];
  /** Inputs lying ON the hull surface — corners AND points inside a face/edge. */
  readonly boundary: ReadonlySet<number>;
  /** Characteristic size of the cloud (max |coordinate|); tolerances scale with it. */
  readonly scale: number;
  /** True when the cloud is empty, degenerate, or flat: `faces` is then empty. */
  readonly degenerate: boolean;
}

export interface Hull3Options {
  /** Visibility threshold, relative to scale. Default 1e-9. */
  eps?: number;
  /** Coplanar-merge tolerance on normals: merge when n₁·n₂ > 1 − this. Default 1e-7. */
  mergeTol?: number;
  /** "On the surface" tolerance for `boundary`, relative to scale. Default 1e-7. */
  touchTol?: number;
}

// ── vector helpers ───────────────────────────────────────────────────────────

const sub = (p: Vec3, q: Vec3): Vec3 => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
const dot = (u: Vec3, v: Vec3): number => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
const cross = (u: Vec3, v: Vec3): Vec3 => [
  u[1] * v[2] - u[2] * v[1],
  u[2] * v[0] - u[0] * v[2],
  u[0] * v[1] - u[1] * v[0],
];
const len = (v: Vec3): number => Math.hypot(v[0], v[1], v[2]);

const EMPTY: Hull3 = {
  faces: [], edges: [], boundary: new Set(), scale: 0, degenerate: true,
};

// ── construction ─────────────────────────────────────────────────────────────

interface Tri { a: number; b: number; c: number; n: Vec3; off: number; alive: boolean }

/** Convex hull of `points` in ℝ³. Duplicate and interior points are harmless. */
export function convexHull3(points: readonly Vec3[], opts: Hull3Options = {}): Hull3 {
  const n = points.length;
  if (n < 4) return EMPTY;

  let scale = 0;
  for (const p of points) scale = Math.max(scale, Math.abs(p[0]), Math.abs(p[1]), Math.abs(p[2]));
  if (!(scale > 0) || !Number.isFinite(scale)) return EMPTY;

  const eps = (opts.eps ?? 1e-9) * scale;
  const mergeTol = opts.mergeTol ?? 1e-7;
  const touch = (opts.touchTol ?? 1e-7) * scale;

  // ── initial tetrahedron: spread the four seeds as far apart as possible, so
  //    every subsequent face normal is well conditioned.
  let i0 = 0;
  for (let i = 1; i < n; i++) if (points[i][0] < points[i0][0]) i0 = i;

  let i1 = -1, best = eps;
  for (let i = 0; i < n; i++) {
    const d = len(sub(points[i], points[i0]));
    if (d > best) { best = d; i1 = i; }
  }
  if (i1 < 0) return { ...EMPTY, scale };

  const e01 = sub(points[i1], points[i0]);
  let i2 = -1; best = eps;
  for (let i = 0; i < n; i++) {
    const d = len(cross(e01, sub(points[i], points[i0]))) / len(e01);
    if (d > best) { best = d; i2 = i; }
  }
  if (i2 < 0) return { ...EMPTY, scale };   // collinear cloud

  const nrm0 = cross(e01, sub(points[i2], points[i0]));
  const nlen = len(nrm0);
  const unit: Vec3 = [nrm0[0] / nlen, nrm0[1] / nlen, nrm0[2] / nlen];
  let i3 = -1; best = eps;
  for (let i = 0; i < n; i++) {
    const d = Math.abs(dot(unit, sub(points[i], points[i0])));
    if (d > best) { best = d; i3 = i; }
  }
  if (i3 < 0) return { ...EMPTY, scale };   // flat cloud — no 3-D hull

  // A point strictly inside the hull, fixed for the whole run: orienting every
  // new face away from it keeps all normals outward without tracking winding.
  const seeds = [i0, i1, i2, i3];
  const interior: Vec3 = [
    (points[i0][0] + points[i1][0] + points[i2][0] + points[i3][0]) / 4,
    (points[i0][1] + points[i1][1] + points[i2][1] + points[i3][1]) / 4,
    (points[i0][2] + points[i1][2] + points[i2][2] + points[i3][2]) / 4,
  ];

  const tris: Tri[] = [];
  const addTri = (a: number, b: number, c: number): void => {
    const nv = cross(sub(points[b], points[a]), sub(points[c], points[a]));
    const l = len(nv);
    if (l <= 0) return;                       // degenerate sliver — drop it
    let normal: Vec3 = [nv[0] / l, nv[1] / l, nv[2] / l];
    let off = dot(normal, points[a]);
    if (dot(normal, interior) - off > 0) {    // facing inward → flip
      normal = [-normal[0], -normal[1], -normal[2]];
      off = -off;
      [b, c] = [c, b];
    }
    tris.push({ a, b, c, n: normal, off, alive: true });
  };

  addTri(i0, i1, i2); addTri(i0, i1, i3); addTri(i0, i2, i3); addTri(i1, i2, i3);

  // ── incremental insertion ──────────────────────────────────────────────────
  const isSeed = new Set(seeds);
  const key = (u: number, v: number): number => u * n + v;

  for (let i = 0; i < n; i++) {
    if (isSeed.has(i)) continue;
    const p = points[i];

    const visible: Tri[] = [];
    for (const t of tris) {
      if (t.alive && dot(t.n, p) - t.off > eps) visible.push(t);
    }
    if (visible.length === 0) continue;       // inside (or on) the current hull

    // Horizon = directed edges of the visible cap whose reverse is NOT visible.
    const dirs = new Set<number>();
    for (const t of visible) { dirs.add(key(t.a, t.b)); dirs.add(key(t.b, t.c)); dirs.add(key(t.c, t.a)); }
    const horizon: [number, number][] = [];
    for (const t of visible) {
      t.alive = false;
      for (const [u, v] of [[t.a, t.b], [t.b, t.c], [t.c, t.a]] as [number, number][]) {
        if (!dirs.has(key(v, u))) horizon.push([u, v]);
      }
    }
    for (const [u, v] of horizon) addTri(u, v, i);
  }

  const live = tris.filter((t) => t.alive);
  if (live.length === 0) return { ...EMPTY, scale };

  const faces = mergeCoplanar(live, mergeTol, scale);
  return {
    faces,
    edges: faceEdges(faces),
    boundary: surfacePoints(points, faces, touch),
    scale,
    degenerate: false,
  };
}

// ── coplanar merge: triangle fan → one polygon per flat face ─────────────────

/**
 * Union adjacent triangles that share a plane, then walk each group's boundary
 * (the directed edges that survive cancellation) into a single CCW loop. A group
 * whose boundary is not one clean cycle falls back to its own triangles.
 */
function mergeCoplanar(tris: readonly Tri[], mergeTol: number, scale: number): Hull3Face[] {
  const m = tris.length;
  const parent = Array.from({ length: m }, (_, i) => i);
  const find = (x: number): number => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const union = (a: number, b: number): void => { const ra = find(a), rb = find(b); if (ra !== rb) parent[rb] = ra; };

  // triangle adjacency by shared undirected edge
  const owner = new Map<string, number>();
  const ekey = (u: number, v: number): string => (u < v ? `${u},${v}` : `${v},${u}`);
  const offTol = 1e-7 * scale;
  tris.forEach((t, i) => {
    for (const [u, v] of [[t.a, t.b], [t.b, t.c], [t.c, t.a]] as [number, number][]) {
      const k = ekey(u, v);
      const j = owner.get(k);
      if (j === undefined) { owner.set(k, i); continue; }
      const s = tris[j];
      if (dot(t.n, s.n) > 1 - mergeTol && Math.abs(t.off - s.off) < offTol) union(i, j);
    }
  });

  const groups = new Map<number, number[]>();
  tris.forEach((_, i) => {
    const r = find(i);
    const g = groups.get(r);
    if (g) g.push(i); else groups.set(r, [i]);
  });

  const faces: Hull3Face[] = [];
  for (const idx of groups.values()) {
    const rep = tris[idx[0]];
    if (idx.length === 1) {
      faces.push({ loop: [rep.a, rep.b, rep.c], normal: rep.n, offset: rep.off });
      continue;
    }
    // An edge interior to the group appears twice, once in each direction;
    // the boundary is what survives that cancellation.
    const directed = new Set<string>();
    for (const i of idx) {
      const t = tris[i];
      for (const [u, v] of [[t.a, t.b], [t.b, t.c], [t.c, t.a]] as [number, number][]) {
        directed.add(`${u},${v}`);
      }
    }
    const dir = new Map<number, number>();   // u → v along the group's boundary
    for (const d of directed) {
      const [u, v] = d.split(',').map(Number);
      if (!directed.has(`${v},${u}`)) dir.set(u, v);
    }
    const loop = walkCycle(dir);
    if (loop && loop.length >= 3) {
      faces.push({ loop, normal: rep.n, offset: rep.off });
    } else {
      for (const i of idx) faces.push({ loop: [tris[i].a, tris[i].b, tris[i].c], normal: tris[i].n, offset: tris[i].off });
    }
  }
  return faces;
}

/** Follow u→v until it closes; null unless the map is one cycle covering it all. */
function walkCycle(dir: ReadonlyMap<number, number>): number[] | null {
  if (dir.size < 3) return null;
  const start = dir.keys().next().value as number;
  const loop: number[] = [start];
  let cur = dir.get(start)!;
  while (cur !== start) {
    if (loop.length > dir.size) return null;   // ran away — not a simple cycle
    loop.push(cur);
    const nxt = dir.get(cur);
    if (nxt === undefined) return null;
    cur = nxt;
  }
  return loop.length === dir.size ? loop : null;
}

// ── derived structure ────────────────────────────────────────────────────────

/** Undirected edges of the face complex, each with its two incident faces. */
function faceEdges(faces: readonly Hull3Face[]): Hull3Edge[] {
  const seen = new Map<string, { a: number; b: number; fs: number[] }>();
  faces.forEach((f, fi) => {
    const L = f.loop;
    for (let i = 0; i < L.length; i++) {
      const u = L[i], v = L[(i + 1) % L.length];
      const k = u < v ? `${u},${v}` : `${v},${u}`;
      const e = seen.get(k);
      if (e) e.fs.push(fi);
      else seen.set(k, { a: Math.min(u, v), b: Math.max(u, v), fs: [fi] });
    }
  });
  const out: Hull3Edge[] = [];
  for (const e of seen.values()) {
    if (e.fs.length === 2) out.push({ a: e.a, b: e.b, f0: e.fs[0], f1: e.fs[1] });
  }
  return out;
}

/** Inputs lying on the surface (within `touch` of some face plane, outermost). */
function surfacePoints(
  points: readonly Vec3[], faces: readonly Hull3Face[], touch: number,
): Set<number> {
  const on = new Set<number>();
  for (let i = 0; i < points.length; i++) {
    let worst = -Infinity;
    for (const f of faces) worst = Math.max(worst, dot(f.normal, points[i]) - f.offset);
    if (worst > -touch) on.add(i);
  }
  return on;
}

/**
 * Hull of a point list with GAPS — the shape a projection hands you, where some
 * generators went to infinity in the chart and have no scene point. Absent
 * points are excluded from the hull, and every index in the result still refers
 * to the original list, so the caller can keep one indexing throughout.
 */
export function convexHull3Sparse(
  points: readonly (Vec3 | null)[], opts: Hull3Options = {},
): Hull3 {
  const dense: Vec3[] = [];
  const toOriginal: number[] = [];
  points.forEach((p, i) => { if (p) { dense.push(p); toOriginal.push(i); } });

  const hull = convexHull3(dense, opts);
  if (hull.degenerate) return hull;
  return {
    faces: hull.faces.map((f) => ({ ...f, loop: f.loop.map((i) => toOriginal[i]) })),
    edges: hull.edges.map((e) => ({ ...e, a: toOriginal[e.a], b: toOriginal[e.b] })),
    boundary: new Set([...hull.boundary].map((i) => toOriginal[i])),
    scale: hull.scale,
    degenerate: false,
  };
}

/**
 * Largest signed distance by which any input point lies OUTSIDE the hull,
 * relative to the cloud's scale. A correct hull gives ~0 (rounding only); a
 * clearly positive value means the construction missed a point.
 */
export function hullViolation(points: readonly Vec3[], hull: Hull3): number {
  if (hull.degenerate || hull.scale === 0) return 0;
  let worst = 0;
  for (const p of points) {
    let inside = -Infinity;
    for (const f of hull.faces) inside = Math.max(inside, dot(f.normal, p) - f.offset);
    worst = Math.max(worst, inside);
  }
  return worst / hull.scale;
}
