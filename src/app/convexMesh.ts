/**
 * Visualize a convex cone (from `core/convex`) through the same ℝⁿ→ℝ³
 * `SceneEmbedding` the limit sets use — so a domain and its limit set share one
 * chart and camera. Three layers, all generic and dimension-agnostic:
 *
 *   • skeleton — the FAITHFUL 1-skeleton: a sphere at each projected extremal
 *     ray, a tube along each edge of the cone. No hull computation.
 *   • body     — the translucent SILHOUETTE: the 3-D convex hull of the projected
 *     rays (a shadow outline — distinct from the true face structure).
 *   • membership — recolor an orbit by which cone (copy) contains each point;
 *     tested in ℝⁿ via the cone's facets, so it is chart-independent.
 *
 * This is the generic replacement for the old per-demo `wireframe.ts` / `hull.ts`
 * / `membership.ts`. Specific cones (their rays) live in `examples/`.
 */

import * as THREE from 'three';
import { ConvexHull } from 'three/examples/jsm/math/ConvexHull.js';
import type { ConvexCone } from '@/core/convex';
import { convexHull3Sparse, type Vec3 } from '@/core/hull3';
import { clipBoxFaces } from '@/core/convexChart';
import type { SceneEmbedding } from '@/core/scene';
import type { Orbit } from '@/core/orbit';

export interface ConeMesh {
  group: THREE.Group;
  dispose(): void;
}

// ── projection ───────────────────────────────────────────────────────────────

/**
 * Project a cone's extremal rays through `embedding`. Returns one entry per ray;
 * `null` marks a ray that the chart sends to infinity (skipped downstream).
 */
export function projectConeVertices(
  cone: ConvexCone,
  embedding: SceneEmbedding,
): (THREE.Vector3 | null)[] {
  const dim = cone.dim;
  const buf = new Float64Array(dim);
  const out = new Float64Array(3);
  return cone.rays.map((r) => {
    for (let j = 0; j < dim; j++) buf[j] = r[j];
    return embedding.embed(buf, 0, out, 0) ? new THREE.Vector3(out[0], out[1], out[2]) : null;
  });
}

// ── skeleton (vertices + edges) ──────────────────────────────────────────────

export interface SkeletonStyle {
  edgeColor: number;
  tubeRadius: number;
  vertexColor: number;
  vertexRadius: number;
}

const UP = new THREE.Vector3(0, 1, 0);

/**
 * Sphere at each projected vertex + tube along each edge, as two InstancedMeshes
 * (two draw calls). Vertices that projected to infinity (`null`) and any edge
 * touching them are skipped. `keep(i)` optionally restricts which vertices draw
 * (e.g. only silhouette-boundary vertices).
 */
export function skeletonMesh(
  vertices: readonly (THREE.Vector3 | null)[],
  edges: readonly (readonly [number, number])[],
  style: SkeletonStyle,
  keep: (i: number) => boolean = () => true,
  keepEdge: (a: number, b: number) => boolean = (a, b) => keep(a) && keep(b),
): ConeMesh {
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];

  const present: THREE.Vector3[] = [];
  vertices.forEach((v, i) => { if (v && keep(i)) present.push(v); });
  if (style.vertexRadius > 0 && present.length) {
    const g = new THREE.SphereGeometry(style.vertexRadius, 14, 10);
    const m = new THREE.MeshBasicMaterial({ color: style.vertexColor });
    const inst = new THREE.InstancedMesh(g, m, present.length);
    const mat = new THREE.Matrix4();
    present.forEach((v, i) => { mat.makeTranslation(v.x, v.y, v.z); inst.setMatrixAt(i, mat); });
    inst.instanceMatrix.needsUpdate = true;
    group.add(inst);
    disposables.push(g, m);
  }

  const live = edges.filter(([a, b]) => vertices[a] && vertices[b] && keepEdge(a, b));
  if (style.tubeRadius > 0 && live.length) {
    const g = new THREE.CylinderGeometry(style.tubeRadius, style.tubeRadius, 1, 8, 1);
    const m = new THREE.MeshBasicMaterial({ color: style.edgeColor });
    const inst = new THREE.InstancedMesh(g, m, live.length);
    const mat = new THREE.Matrix4(), q = new THREE.Quaternion();
    const dir = new THREE.Vector3(), mid = new THREE.Vector3(), scale = new THREE.Vector3();
    live.forEach(([a, b], i) => {
      const va = vertices[a]!, vb = vertices[b]!;
      dir.subVectors(vb, va);
      const len = dir.length();
      if (len < 1e-12) { mat.makeScale(0, 0, 0); inst.setMatrixAt(i, mat); return; }
      dir.divideScalar(len);
      q.setFromUnitVectors(UP, dir);
      mid.addVectors(va, vb).multiplyScalar(0.5);
      scale.set(1, len, 1);
      mat.compose(mid, q, scale);
      inst.setMatrixAt(i, mat);
    });
    inst.instanceMatrix.needsUpdate = true;
    group.add(inst);
    disposables.push(g, m);
  }

  return { group, dispose() { for (const d of disposables) d.dispose(); } };
}

// ── body (silhouette hull) ───────────────────────────────────────────────────

export interface Silhouette {
  /** Input ray indices whose projected point lies ON the silhouette surface. */
  boundary: Set<number>;
  /** Flat triangle positions (9 floats per triangle) for the body mesh. */
  facePositions: number[];
}

/**
 * Silhouette = the 3-D convex hull of the projected rays (a shadow outline, NOT
 * the projection of the cone's faces). `boundary` is every ray lying on the hull
 * surface (corners AND points on a flat face/edge), used to optionally hide
 * interior wireframe vertices.
 */
export function coneSilhouette(
  points: readonly (THREE.Vector3 | null)[],
  clipExtent?: number,
): Silhouette {
  // When the piece was truncated, the cut planes are π_a = ±M — axis-aligned in
  // chart space. Anything lying on one of them is the flat lid the cut left, not
  // boundary of the domain, and is left out so the body is OPEN there.
  const lidFace = (vs: readonly THREE.Vector3[]): boolean => {
    if (!clipExtent) return false;
    const tol = 1e-3 * clipExtent;
    const co = (p: THREE.Vector3, a: number): number => (a === 0 ? p.x : a === 1 ? p.y : p.z);
    for (let a = 0; a < 3; a++) {
      for (const sg of [1, -1]) {
        if (vs.every((p) => Math.abs(co(p, a) - sg * clipExtent) < tol)) return true;
      }
    }
    return false;
  };

  const boundary = new Set<number>();
  const facePositions: number[] = [];

  const live: { p: THREE.Vector3; i: number }[] = [];
  points.forEach((p, i) => { if (p) live.push({ p, i }); });
  if (live.length < 4) return { boundary, facePositions };

  const hull = new ConvexHull().setFromPoints(live.map((l) => l.p));

  for (const f of hull.faces) {
    const vs: THREE.Vector3[] = [];
    let e = f.edge;
    do { vs.push(e.head().point); e = e.next; } while (e !== f.edge);
    if (lidFace(vs)) continue;
    for (let i = 1; i + 1 < vs.length; i++) {
      facePositions.push(
        vs[0].x, vs[0].y, vs[0].z,
        vs[i].x, vs[i].y, vs[i].z,
        vs[i + 1].x, vs[i + 1].y, vs[i + 1].z,
      );
    }
  }

  let ext = 0;
  for (const { p } of live) ext = Math.max(ext, Math.abs(p.x), Math.abs(p.y), Math.abs(p.z));
  const eps = Math.max(hull.tolerance, 1e-7 * (ext || 1));
  const dist = (f: unknown, p: THREE.Vector3): number =>
    (f as { distanceToPoint(pt: THREE.Vector3): number }).distanceToPoint(p);
  for (const { p, i } of live) {
    let maxDist = -Infinity;
    for (const f of hull.faces) { const d = dist(f, p); if (d > maxDist) maxDist = d; }
    if (maxDist > -eps) boundary.add(i);
  }
  return { boundary, facePositions };
}

/** Translucent body mesh from silhouette face positions. */
export function bodyMesh(facePositions: readonly number[], color: number, opacity: number): ConeMesh {
  const group = new THREE.Group();
  if (facePositions.length === 0) return { group, dispose() {} };
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(facePositions as number[], 3));
  geom.computeVertexNormals();
  const mtl = new THREE.MeshBasicMaterial({
    color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false,
  });
  group.add(new THREE.Mesh(geom, mtl));
  return { group, dispose() { geom.dispose(); mtl.dispose(); } };
}

// ── high-level: a whole cone domain in one projection ─────────────────────────

export interface ConeDomainStyle extends SkeletonStyle {
  bodyColor: number;
  bodyOpacity: number;
}

export interface ConeDomainOpts {
  showVertices?: boolean;
  showEdges?: boolean;
  showBody?: boolean;
  /** When false, hide wireframe vertices/edges interior to the silhouette. */
  showInterior?: boolean;
  /**
   * Derive the wireframe from the 3-D hull of the PROJECTED points instead of
   * the cone's own 1-skeleton. For a piece cut out of a cone (a half of a domain
   * that runs through infinity) the ambient 1-skeleton is not the piece's, so
   * there is nothing else to draw.
   */
  hullEdges?: boolean;
  /**
   * Truncation half-width this piece was cut at, if it was. The flat lids left
   * on that box are dropped — body, rim edges, and rim corners — so the piece
   * reads as running off to infinity rather than ending at a wall.
   */
  clipExtent?: number;
}

/**
 * Project a cone once and build its skeleton + translucent body together. The
 * silhouette is computed when the body is shown OR interior vertices are hidden
 * (it supplies the boundary filter). Returns the merged group + the boundary set.
 */
export function coneDomainMesh(
  cone: ConvexCone,
  embedding: SceneEmbedding,
  style: ConeDomainStyle,
  opts: ConeDomainOpts = {},
): ConeMesh & { boundary: Set<number>; allLids: boolean } {
  const {
    showVertices = true, showEdges = true, showBody = true,
    showInterior = false, hullEdges = false, clipExtent,
  } = opts;
  const points = projectConeVertices(cone, embedding);

  // A corner on the cut is a rim of the opening, not a vertex of the domain.
  const tol = clipExtent ? 1e-3 * clipExtent : 0;
  const onBox = (i: number): boolean => {
    const p = points[i];
    if (!clipExtent || !p) return false;
    return Math.abs(Math.abs(p.x) - clipExtent) < tol
      || Math.abs(Math.abs(p.y) - clipExtent) < tol
      || Math.abs(Math.abs(p.z) - clipExtent) < tol;
  };

  // core/hull3 merges coplanar triangles, so a flat face contributes its own
  // boundary rather than a fan of interior chords. Edges with BOTH ends on the
  // cut are the lid's own rim and go; an edge with one end there is a real edge
  // running out to where the body was truncated, and is kept — that is the cue
  // that the piece continues. The hull is also needed for the vertex CORNER set
  // (below), so compute it whenever vertices are drawn.
  const h3 = (hullEdges || clipExtent || showVertices)
    ? convexHull3Sparse(points.map((p) => (p ? [p.x, p.y, p.z] as Vec3 : null)))
    : null;
  const wireEdges = (h3 && hullEdges)
    ? h3.edges.filter((e) => !(onBox(e.a) && onBox(e.b))).map((e) => [e.a, e.b] as [number, number])
    : cone.edges;
  // Vertex spheres sit ONLY at true hull corners (the vertices appearing in the
  // face loops), never at a ray that merely lands on a face's interior. Null in
  // the degenerate case ⇒ no restriction.
  const cornerSet = h3 ? new Set<number>() : null;
  if (h3 && cornerSet) for (const f of h3.faces) for (const i of f.loop) cornerSet.add(i);
  // Every face a lid means the piece's SHADOW fills the truncation box: this
  // projection collapses it completely, and once the lids go there is nothing
  // left to draw. Reported so the caller can say so rather than show a blank.
  const lids = (h3 && clipExtent) ? clipBoxFaces(h3, clipExtent) : null;
  const allLids = !!(lids && h3 && h3.faces.length > 0 && lids.size === h3.faces.length);

  let boundary = new Set<number>();
  let facePositions: number[] = [];
  let hullOk = true;
  if (showBody || !showInterior) {
    try {
      const s = coneSilhouette(points, clipExtent);
      boundary = s.boundary;
      facePositions = s.facePositions;
    } catch {
      hullOk = false; // degenerate projection — draw the full skeleton, no body
    }
  }

  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  const keep = (showInterior || !hullOk) ? () => true : (i: number) => boundary.has(i);

  if (showVertices || showEdges) {
    // A corner ON the cut is the rim of the opening, not a vertex of the domain,
    // so it gets no sphere; an edge running OUT to the cut is a real edge of the
    // body and is kept — that is what shows it continuing past the truncation.
    const keepVertex = (i: number): boolean =>
      keep(i) && !onBox(i) && (!cornerSet || cornerSet.has(i));
    const wire = skeletonMesh(points, wireEdges, {
      edgeColor: style.edgeColor,
      tubeRadius: showEdges ? style.tubeRadius : 0,
      vertexColor: style.vertexColor,
      vertexRadius: showVertices ? style.vertexRadius : 0,
    }, keepVertex, (a, b) => keep(a) && keep(b));
    group.add(wire.group);
    disposables.push(wire);
  }
  if (showBody) {
    const body = bodyMesh(facePositions, style.bodyColor, style.bodyOpacity);
    group.add(body.group);
    disposables.push(body);
  }

  return { group, boundary, allLids, dispose() { for (const d of disposables) d.dispose(); } };
}

// ── membership coloring ──────────────────────────────────────────────────────

export type RGB = readonly [number, number, number];
export interface ColoredCone { cone: ConvexCone; rgb: RGB; }

const BLACK: RGB = [0, 0, 0];
const EPS = 1e-9;

/** 0xRRGGBB → [r, g, b] in 0..1. */
export function hexToRgb(hex: number): RGB {
  return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
}

/**
 * Projective membership: does the state at (buf, off) lie in the cone (up to
 * sign)? A pointed cone sits in one halfspace, but an orbit point may carry
 * either projective sign, so we accept it if every facet agrees in sign — all
 * f·x ≥ 0 (in K) or all f·x ≤ 0 (in −K).
 */
function inConeProjective(facets: readonly (readonly number[])[], buf: Float64Array, off: number): boolean {
  let allGE = true, allLE = true;
  for (const f of facets) {
    let d = 0;
    for (let j = 0; j < f.length; j++) d += f[j] * buf[off + j];
    if (d < -EPS) allGE = false;
    if (d > EPS) allLE = false;
    if (!allGE && !allLE) return false;
  }
  return true;
}

export interface InstanceData {
  aPos: Float32Array;
  aColor: Float32Array;
  kept: number;
}

/**
 * Embed an orbit and color each surviving point by the first cone (copy) that
 * contains it, else black. Containment is tested in ℝⁿ on the orbit's own
 * coordinates, so the cones' facets must be expressed in that same space (use
 * `transformCone` for copies). One embed pass.
 */
export function coneMembershipInstances(
  embedding: SceneEmbedding,
  orbit: Orbit,
  cones: readonly ColoredCone[],
): InstanceData {
  const { count, vecs } = orbit;
  const stride = embedding.stateDim;

  const tmpPos = new Float64Array(count * 3);
  const keptIdx = new Uint32Array(count);
  let kept = 0;
  for (let i = 0; i < count; i++) {
    if (embedding.embed(vecs, i * stride, tmpPos, kept * 3)) keptIdx[kept++] = i;
  }

  const aPos = new Float32Array(kept * 3);
  for (let k = 0; k < kept * 3; k++) aPos[k] = tmpPos[k];

  const aColor = new Float32Array(kept * 3);
  for (let k = 0; k < kept; k++) {
    const off = keptIdx[k] * stride;
    let rgb: RGB = BLACK;
    for (const c of cones) if (inConeProjective(c.cone.facets, vecs, off)) { rgb = c.rgb; break; }
    aColor[k * 3] = rgb[0];
    aColor[k * 3 + 1] = rgb[1];
    aColor[k * 3 + 2] = rgb[2];
  }

  return { aPos, aColor, kept };
}
