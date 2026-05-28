/**
 * Generic instanced-spheres mesh for live limit-set previews.
 *
 *   createSphereMaterial    — Phong-ish material with one `uRadius` uniform.
 *   makeInstancedSpheres    — InstancedBufferGeometry over a unit sphere with
 *                             per-instance `aPos` (vec3 scene-space position)
 *                             and `aColor` (vec3 RGB).
 *
 * The vertex shader is trivial — `worldPos = aPos + position * uRadius`.
 * Every group's scene embedding gets baked into `aPos` on the CPU before
 * upload (see `buildOrbitInstances`), so the shader and material are reused
 * verbatim across groups.
 *
 * Frustum culling is disabled: the per-instance offset isn't visible to
 * Three.js's bounding logic, so the auto culler would discard the mesh
 * the moment the camera moves.
 */

import * as THREE from 'three';

const VERT = /* glsl */`
  uniform float uRadius;
  attribute vec3 aPos;
  attribute vec3 aColor;
  varying vec3 vNormal;
  varying vec3 vColor;
  void main() {
    vec3 worldPos = aPos + position * uRadius;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(worldPos, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vColor  = aColor;
  }
`;

const FRAG = /* glsl */`
  varying vec3 vNormal;
  varying vec3 vColor;
  void main() {
    vec3 N = normalize(vNormal);
    vec3 L = normalize(vec3(0.4, 0.8, 0.6));
    float diff = max(dot(N, L), 0.0);
    float amb = 0.35;
    vec3 col = vColor * (amb + diff * 0.85);
    gl_FragColor = vec4(col, 1.0);
  }
`;

export interface SphereUniforms {
  uRadius: { value: number };
  [u: string]: THREE.IUniform;
}

export function createSphereMaterial(initialRadius = 0.025): {
  material: THREE.ShaderMaterial;
  uniforms: SphereUniforms;
} {
  const uniforms: SphereUniforms = {
    uRadius: { value: initialRadius },
  };
  const material = new THREE.ShaderMaterial({
    vertexShader:   VERT,
    fragmentShader: FRAG,
    uniforms,
  });
  return { material, uniforms };
}

const sphereGeo = new THREE.SphereGeometry(1, 8, 6);

export function makeInstancedSpheres(
  material: THREE.ShaderMaterial,
  aPos:   Float32Array,
  aColor: Float32Array,
): THREE.Mesh {
  const kept = aPos.length / 3;
  const instGeo = new THREE.InstancedBufferGeometry();
  instGeo.index = sphereGeo.index;
  for (const name of Object.keys(sphereGeo.attributes)) {
    instGeo.setAttribute(name, sphereGeo.attributes[name]);
  }
  instGeo.boundingSphere = null;
  instGeo.boundingBox = null;
  instGeo.instanceCount = kept;
  instGeo.setAttribute('aPos',   new THREE.InstancedBufferAttribute(aPos, 3));
  instGeo.setAttribute('aColor', new THREE.InstancedBufferAttribute(aColor, 3));

  const mesh = new THREE.Mesh(instGeo, material);
  mesh.frustumCulled = false;
  return mesh;
}
