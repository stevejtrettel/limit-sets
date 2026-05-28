/**
 * Group-agnostic Three.js OrbitControls auto-framer.
 *
 *   autofitCamera(app, scenePoints, count, { dir })
 *
 * Takes a packed buffer of R³ scene points (x,y,z interleaved — same layout
 * a SceneEmbedding writes via `embedOrbit`). Computes a 15th–85th percentile
 * bbox for the dense core (long fuzzy tails fall off the edges), sets
 * `app.controls.target` to the center and backs the camera off along `dir`
 * so the bbox sphere fills the perspective frustum.
 *
 * `dir` defaults to (0.4, 0.4, 1) — a slightly-off-axis perspective view
 * good for 3D limit sets on a sphere. For planar limit sets (z = 0) pass
 * `dir = (0, 0, 1)` to look straight down for a flat picture.
 *
 * Caller is responsible for the embedding pass; this function never looks at
 * an orbit or a GroupAction.
 */

import * as THREE from 'three';
import type { App } from './App.ts';

function percentile(arr: Float32Array, n: number, p: number): number {
  const tmp = arr.slice(0, n);
  tmp.sort();
  const idx = Math.max(0, Math.min(n - 1, Math.floor(n * p)));
  return tmp[idx];
}

export interface AutofitOptions {
  /** Unit-vector direction along which to back the camera off the bbox centre. */
  dir?: readonly [number, number, number];
}

export function autofitCamera(
  app: App,
  scenePoints: ArrayLike<number>,
  count: number,
  opts: AutofitOptions = {},
): void {
  if (count === 0) return;

  const xs = new Float32Array(count);
  const ys = new Float32Array(count);
  const zs = new Float32Array(count);
  let m = 0;
  for (let i = 0; i < count; i++) {
    const x = scenePoints[3 * i];
    const y = scenePoints[3 * i + 1];
    const z = scenePoints[3 * i + 2];
    if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
      xs[m] = x; ys[m] = y; zs[m] = z;
      m++;
    }
  }
  if (m === 0) return;

  const xLo = percentile(xs, m, 0.15), xHi = percentile(xs, m, 0.85);
  const yLo = percentile(ys, m, 0.15), yHi = percentile(ys, m, 0.85);
  const zLo = percentile(zs, m, 0.15), zHi = percentile(zs, m, 0.85);

  const center = new THREE.Vector3(
    (xLo + xHi) * 0.5,
    (yLo + yHi) * 0.5,
    (zLo + zHi) * 0.5,
  );
  const hx = (xHi - xLo) * 0.5;
  const hy = (yHi - yLo) * 0.5;
  const hz = (zHi - zLo) * 0.5;
  const r = Math.max(0.5, Math.sqrt(hx * hx + hy * hy + hz * hz));

  const cam = app.camera as THREE.PerspectiveCamera;
  const halfFov = (cam.fov * Math.PI / 180) * 0.5;
  const dist = 2 * r / Math.tan(halfFov);

  const d = opts.dir ?? [0.4, 0.4, 1];
  const dir = new THREE.Vector3(d[0], d[1], d[2]).normalize();
  app.controls.target.copy(center);
  app.camera.position.copy(center).addScaledVector(dir, dist);
  app.controls.update();
}
