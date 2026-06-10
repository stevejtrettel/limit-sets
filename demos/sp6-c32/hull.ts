/**
 * Glass-style convex hull mesh for the C-32 cone overlay.
 *
 * Given a set of R³ points (the projected extremal rays), build a
 * THREE.Group with three layers:
 *   - faces    — the convex hull surface, rendered clear/translucent so the
 *                limit set shows through (unlit MeshBasicMaterial; the scene
 *                has no lights).
 *   - edges    — the polytope's true edges as thin tubes (instanced unit
 *                cylinders). Coplanar-triangle seams from the triangulated
 *                hull are filtered out via EdgesGeometry's angle threshold.
 *   - vertices — small spheres at the hull's corners.
 *
 * The hull triangulation comes from three's ConvexGeometry (a quickhull).
 * Edge/vertex geometry is derived from EdgesGeometry so we draw genuine
 * polytope edges, not triangulation diagonals.
 *
 * Disposal: shared unit cylinder/sphere geometries are module-level and
 * never disposed; per-build geometries + materials are tracked on
 * `group.userData.disposables` and freed by `disposeHullGroup`.
 */

import * as THREE from 'three';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';

export interface HullStyle {
  tubeRadius: number;
  vertexRadius: number;
  faceColor: number;
  faceOpacity: number;
  edgeColor: number;
  vertexColor: number;
  /** Angle (deg) below which an edge between two faces is treated as flat. */
  edgeThresholdDeg?: number;
}

export interface HullBuild {
  group: THREE.Group;
  vertexCount: number;
  edgeCount: number;
}

// Unit primitives reused across every build (axis = +Y, unit size).
const UNIT_CYLINDER = new THREE.CylinderGeometry(1, 1, 1, 12, 1);
const UNIT_SPHERE = new THREE.SphereGeometry(1, 16, 12);
const Y_AXIS = new THREE.Vector3(0, 1, 0);

function vertKey(x: number, y: number, z: number): string {
  return `${x.toFixed(5)},${y.toFixed(5)},${z.toFixed(5)}`;
}

export function buildHullGroup(points: THREE.Vector3[], style: HullStyle): HullBuild {
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];

  let hullGeo: THREE.BufferGeometry | null = null;
  if (points.length >= 4) {
    try {
      hullGeo = new ConvexGeometry(points);
    } catch (e) {
      console.warn('[sp6-c32] convex hull failed, drawing vertices only:', e);
      hullGeo = null;
    }
  }

  // ── Faces (clear) ──────────────────────────────────────────────────────────
  if (hullGeo) {
    const faceMat = new THREE.MeshBasicMaterial({
      color: style.faceColor,
      transparent: true,
      opacity: style.faceOpacity,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const faces = new THREE.Mesh(hullGeo, faceMat);
    faces.frustumCulled = false;
    group.add(faces);
    disposables.push(hullGeo, faceMat);
  }

  // ── Collect polytope edges + corner vertices ────────────────────────────────
  const edges: [THREE.Vector3, THREE.Vector3][] = [];
  const verts: THREE.Vector3[] = [];
  if (hullGeo) {
    const edgesGeo = new THREE.EdgesGeometry(hullGeo, style.edgeThresholdDeg ?? 1);
    const pos = edgesGeo.getAttribute('position') as THREE.BufferAttribute;
    const seen = new Map<string, THREE.Vector3>();
    for (let i = 0; i < pos.count; i += 2) {
      const a = new THREE.Vector3().fromBufferAttribute(pos, i);
      const b = new THREE.Vector3().fromBufferAttribute(pos, i + 1);
      edges.push([a, b]);
      for (const p of [a, b]) {
        const k = vertKey(p.x, p.y, p.z);
        if (!seen.has(k)) seen.set(k, p);
      }
    }
    verts.push(...seen.values());
    edgesGeo.dispose();
  } else {
    verts.push(...points);
  }

  // ── Edges as thin tubes (instanced cylinders) ───────────────────────────────
  if (edges.length > 0) {
    const edgeMat = new THREE.MeshBasicMaterial({ color: style.edgeColor });
    const inst = new THREE.InstancedMesh(UNIT_CYLINDER, edgeMat, edges.length);
    inst.frustumCulled = false;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const mid = new THREE.Vector3();
    const dir = new THREE.Vector3();
    const scale = new THREE.Vector3();
    for (let i = 0; i < edges.length; i++) {
      const [a, b] = edges[i];
      dir.subVectors(b, a);
      const len = dir.length();
      mid.addVectors(a, b).multiplyScalar(0.5);
      q.setFromUnitVectors(Y_AXIS, dir.clone().normalize());
      scale.set(style.tubeRadius, len, style.tubeRadius);
      m.compose(mid, q, scale);
      inst.setMatrixAt(i, m);
    }
    inst.instanceMatrix.needsUpdate = true;
    group.add(inst);
    disposables.push(edgeMat);
  }

  // ── Vertices as spheres (instanced) ─────────────────────────────────────────
  if (verts.length > 0) {
    const vertMat = new THREE.MeshBasicMaterial({ color: style.vertexColor });
    const inst = new THREE.InstancedMesh(UNIT_SPHERE, vertMat, verts.length);
    inst.frustumCulled = false;
    const m = new THREE.Matrix4();
    const s = new THREE.Vector3(style.vertexRadius, style.vertexRadius, style.vertexRadius);
    const q = new THREE.Quaternion();
    for (let i = 0; i < verts.length; i++) {
      m.compose(verts[i], q, s);
      inst.setMatrixAt(i, m);
    }
    inst.instanceMatrix.needsUpdate = true;
    group.add(inst);
    disposables.push(vertMat);
  }

  group.userData.disposables = disposables;
  return { group, vertexCount: verts.length, edgeCount: edges.length };
}

export function disposeHullGroup(group: THREE.Group): void {
  const disposables = group.userData.disposables as { dispose(): void }[] | undefined;
  if (disposables) for (const d of disposables) d.dispose();
  group.clear();
}
