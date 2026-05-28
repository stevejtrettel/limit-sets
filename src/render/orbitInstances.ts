/**
 * Build GPU-ready instance attributes for a stored Orbit + SceneEmbedding,
 * coloured per the active ColorScheme + Palette.
 *
 *   aPos[3k..3k+3]   — (x, y, z) of the k-th kept orbit point in scene space
 *   aColor[3k..3k+3] — palette[category] for that point
 *
 * "Kept" = embedding.embed returned true (chart-singular points dropped).
 * Group-agnostic; lives in src/render/ alongside other pixel-data builders.
 *
 * One CPU pass over the orbit. The returned `aPos` is suitable both for
 * the live-preview instanced mesh *and* for camera autofit — pass it
 * straight to `autofitCamera(app, aPos, kept)`.
 */

import type { Orbit } from '../core/orbit.ts';
import type { SceneEmbedding } from '../core/scene.ts';
import {
  type ColorScheme,
  categoryFromOrbit,
} from './colorScheme.ts';
import type { Palette } from './tone.ts';

export interface OrbitInstanceData {
  aPos:   Float32Array;
  aColor: Float32Array;
  /** Number of kept orbit points (aPos / aColor each hold `kept · 3` floats). */
  kept:   number;
}

export function buildOrbitInstances(
  embedding: SceneEmbedding,
  orbit: Orbit,
  scheme: ColorScheme,
  palette: Palette,
): OrbitInstanceData {
  const { count, lastGen, parents } = orbit;
  const stride = embedding.stateDim;
  const stepsBack = scheme.stepsBack;

  // One pass: embed each orbit point, remember which ones survived.
  const tmpPos = new Float64Array(count * 3);
  const keptIdx = new Uint32Array(count);
  let kept = 0;
  for (let i = 0; i < count; i++) {
    if (embedding.embed(orbit.vecs, i * stride, tmpPos, kept * 3)) {
      keptIdx[kept] = i;
      kept++;
    }
  }

  // Pack tight Float32 outputs for the GPU.
  const aPos = new Float32Array(kept * 3);
  for (let k = 0; k < kept * 3; k++) aPos[k] = tmpPos[k];

  const aColor = new Float32Array(kept * 3);
  for (let k = 0; k < kept; k++) {
    const i = keptIdx[k];
    const cat = stepsBack < 0
      ? 0
      : categoryFromOrbit(stepsBack, lastGen, parents, i);
    const col = palette[cat];
    aColor[k * 3]     = col[0];
    aColor[k * 3 + 1] = col[1];
    aColor[k * 3 + 2] = col[2];
  }

  return { aPos, aColor, kept };
}
