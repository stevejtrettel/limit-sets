/**
 * The silhouette (shadow) of the projected points: the convex hull of the
 * projected vertices in ℝ³. From one hull build we expose
 *   • `boundary` — which input indices land ON the silhouette (the rest project
 *     to its interior); used to optionally hide interior wireframe vertices.
 *   • `facePositions` — triangulated faces for the translucent "body" mesh.
 *
 * NB: this is the convex hull of the *projected* points — the shadow outline —
 * not the projection of the polytope's faces. The true vertices/edges come from
 * the combinatorial 1-skeleton (topology.ts), drawn by wireframe.ts.
 */

import * as THREE from 'three';
import { ConvexHull } from 'three/examples/jsm/math/ConvexHull.js';

export interface Shadow {
  /** Input indices whose projected point lies on the silhouette boundary. */
  boundary: Set<number>;
  /** Flat triangle positions (9 floats per triangle) for the body mesh. */
  facePositions: number[];
}

/** Build the silhouette hull of `points` (nulls = vertices at infinity, skipped)
 *  and return its boundary index set + triangulated faces.
 *
 *  A vertex is "boundary" iff it lies ON the silhouette surface — i.e. it
 *  touches some hull face plane — NOT merely if it is a hull corner. Rays that
 *  project onto the interior of a face or edge are on the boundary too (the cone
 *  is flat in places), and their edges must be kept. */
export function computeShadow(points: readonly (THREE.Vector3 | null)[]): Shadow {
  const boundary = new Set<number>();
  const facePositions: number[] = [];

  const live: { p: THREE.Vector3; i: number }[] = [];
  points.forEach((p, i) => { if (p) live.push({ p, i }); });
  if (live.length < 4) return { boundary, facePositions };

  const hull = new ConvexHull().setFromPoints(live.map((l) => l.p));

  // triangulated faces for the body mesh
  for (const f of hull.faces) {
    const vs: THREE.Vector3[] = [];
    let e = f.edge;
    do { vs.push(e.head().point); e = e.next; } while (e !== f.edge);
    for (let i = 1; i + 1 < vs.length; i++) {
      facePositions.push(
        vs[0].x, vs[0].y, vs[0].z,
        vs[i].x, vs[i].y, vs[i].z,
        vs[i + 1].x, vs[i + 1].y, vs[i + 1].z,
      );
    }
  }

  // boundary = points not strictly interior (touch some face plane)
  let ext = 0;
  for (const { p } of live) ext = Math.max(ext, Math.abs(p.x), Math.abs(p.y), Math.abs(p.z));
  const eps = Math.max(hull.tolerance, 1e-7 * (ext || 1));
  // @types/three doesn't declare Face.distanceToPoint, but it exists at runtime
  // (signed distance to the face plane, outward normal).
  const dist = (f: unknown, p: THREE.Vector3): number =>
    (f as { distanceToPoint(pt: THREE.Vector3): number }).distanceToPoint(p);
  for (const { p, i } of live) {
    let maxDist = -Infinity;
    for (const f of hull.faces) {
      const d = dist(f, p);
      if (d > maxDist) maxDist = d;
    }
    if (maxDist > -eps) boundary.add(i);
  }
  return { boundary, facePositions };
}

export interface HullBody {
  group: THREE.Group;
  dispose(): void;
}

/** Translucent body mesh from precomputed silhouette face positions. */
export function buildBodyMesh(facePositions: number[], faceColor: number, faceOpacity: number): HullBody {
  const group = new THREE.Group();
  if (facePositions.length === 0) return { group, dispose() {} };
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(facePositions, 3));
  geom.computeVertexNormals();
  const mtl = new THREE.MeshBasicMaterial({
    color: faceColor, transparent: true, opacity: faceOpacity,
    side: THREE.DoubleSide, depthWrite: false,
  });
  group.add(new THREE.Mesh(geom, mtl));
  return { group, dispose() { geom.dispose(); mtl.dispose(); } };
}
