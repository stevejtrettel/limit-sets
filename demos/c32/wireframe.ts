/**
 * Wireframe of a projected polytope: a sphere at each vertex and a tube along
 * each edge of the precomputed 1-skeleton (see topology.ts). Both layers are
 * single InstancedMeshes — two draw calls for the whole skeleton.
 *
 * Vertices may be `null` (a vertex that projected to infinity); such vertices
 * and any edge touching them are skipped.
 */

import * as THREE from 'three';

export interface WireStyle {
  edgeColor: number;
  tubeRadius: number;
  vertexColor: number;
  vertexRadius: number;
}

export interface WireObject {
  group: THREE.Group;
  dispose(): void;
}

const UP = new THREE.Vector3(0, 1, 0);

export function buildWireframe(
  vertices: readonly (THREE.Vector3 | null)[],
  edges: readonly (readonly [number, number])[],
  style: WireStyle,
  /** Optional filter: only draw vertex i (and edges with both ends kept) when
   *  `keep(i)` is true. Default keeps everything. */
  keep: (i: number) => boolean = () => true,
): WireObject {
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];

  // vertices → instanced spheres
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

  // edges → instanced unit cylinders (default along +Y, height 1, centered)
  const live = edges.filter(([a, b]) => vertices[a] && vertices[b] && keep(a) && keep(b));
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
