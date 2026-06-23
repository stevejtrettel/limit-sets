/**
 * Build (and hot-swap) the instanced-sphere mesh for a limit-set orbit — the
 * body every demo's `rebuildMesh` shares: color the orbit via the active scheme,
 * pack GPU instances, swap the old mesh for the new, and optionally autofit the
 * camera. The demo keeps its own `currentMesh` / `stats` state and just calls
 * this.
 */

import * as THREE from 'three';
import type { App } from './App.ts';
import { makeInstancedSpheres } from './instancedSpheres.ts';
import { autofitCamera } from './autofit.ts';
import type { Orbit } from '../core/orbit.ts';
import type { SceneEmbedding } from '../core/scene.ts';
import { schemeForColorDepth } from '../render/colorScheme.ts';
import { buildOrbitInstances } from '../render/orbitInstances.ts';
import type { Palette } from '../render/tone.ts';

export interface LimitSetMeshOpts {
  app: App;
  material: THREE.Material;
  embedding: SceneEmbedding;
  orbit: Orbit;
  /** Browser color-depth value (0 = grayscale, 1 = last letter, …). */
  colorDepth: number;
  paletteForScheme: (schemeName: string) => Palette;
  /** Mesh to remove + dispose (null on first build). */
  previous: THREE.Mesh | null;
  /** Refit the camera to the new point cloud. */
  autofit: boolean;
  /** Camera back-off direction for the autofit (sl2c/sl3r vary it per embedding). */
  autofitDir?: readonly [number, number, number];
}

/** Returns the new mesh and the number of kept (chart-projected) points. */
export function buildLimitSetMesh(o: LimitSetMeshOpts): { mesh: THREE.Mesh; kept: number } {
  const scheme = schemeForColorDepth(o.colorDepth);
  const { aPos, aColor, kept } = buildOrbitInstances(
    o.embedding, o.orbit, scheme, o.paletteForScheme(scheme.name),
  );

  const mesh = makeInstancedSpheres(o.material, aPos, aColor);
  if (o.previous) {
    o.app.scene.remove(o.previous);
    o.previous.geometry.dispose();
  }
  o.app.scene.add(mesh);
  if (o.autofit) autofitCamera(o.app, aPos, kept, o.autofitDir ? { dir: o.autofitDir } : {});

  return { mesh, kept };
}
