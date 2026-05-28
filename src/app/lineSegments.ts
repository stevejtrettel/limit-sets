/**
 * Generic colored line-segment mesh for live limit-set previews. Companion
 * to [./instancedSpheres.ts](./instancedSpheres.ts) for demos that draw
 * configurations (boxes, tile boundaries, vector fields, …) instead of
 * point clouds.
 *
 *   createLineSegmentsMaterial — vertex-colored `LineBasicMaterial`.
 *   makeColoredLineSegments    — `THREE.LineSegments` over a pair of
 *                                 packed buffers. Vertices come in pairs:
 *                                 (positions[2k], positions[2k+1]) is the
 *                                 k-th segment.
 *
 * Buffers are 3 floats per vertex (positions in scene space) and 3 floats
 * per vertex (RGB color, 0..1). `count` allows passing oversized buffers
 * (e.g. allocated for the worst-case vertex count and only partially
 * filled) — only the first `count` vertices are uploaded.
 *
 * Frustum culling is left enabled here (unlike instancedSpheres) because
 * the segment vertex positions ARE visible to Three.js's bounding logic.
 */

import * as THREE from 'three';

export function createLineSegmentsMaterial(): THREE.LineBasicMaterial {
  return new THREE.LineBasicMaterial({ vertexColors: true });
}

export function makeColoredLineSegments(
  material: THREE.LineBasicMaterial,
  positions: Float32Array,
  colors:    Float32Array,
  count:     number,
): THREE.LineSegments {
  const geom = new THREE.BufferGeometry();
  // Only upload the live portion of each buffer — caller may have allocated
  // the worst-case max vertex count.
  geom.setAttribute('position', new THREE.BufferAttribute(
    positions.subarray(0, count * 3), 3,
  ));
  geom.setAttribute('color', new THREE.BufferAttribute(
    colors.subarray(0, count * 3), 3,
  ));
  return new THREE.LineSegments(geom, material);
}
