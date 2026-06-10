/**
 * C-32 cone K — its 254 extremal rays (stage 4; see implementation.md).
 *
 * The rays in background/c32_extremal_rays.json are u-coordinate COLUMN vectors
 * rᵢ (all with y₀ > 0: K sits in {y₀ > 0}). `transformedRays(g)` applies a
 * u-basis transform g and returns the copy's rays as companion COLUMN vectors
 * P·g·rᵢ — these flow through the *same* `coordChart` as the orbit (in the
 * u-basis the chart undoes the P; companion reads it). One render path for
 * orbit + every domain copy. The base cone is `transformedRays(identity)`.
 */

import raysData from './background/c32_extremal_rays.json';
import { P } from './coords';
import { matmul6 } from './mat6';

export const RAYS_U: readonly (readonly number[])[] =
  raysData.rays as readonly (readonly number[])[];
export const NUM_RAYS: number = raysData.num_rays;

/** Rays of the copy g·K as companion column vectors, flat Float64Array of length
 *  NUM_RAYS·6: cᵢ = P·g·rᵢ (g in u-coords, then to companion via P). */
export function transformedRays(g: readonly (readonly number[])[]): Float64Array {
  const Pg = matmul6(P, g);   // cᵢ = P·g·rᵢ
  const out = new Float64Array(NUM_RAYS * 6);
  for (let k = 0; k < NUM_RAYS; k++) {
    const r = RAYS_U[k];
    for (let i = 0; i < 6; i++) {
      let s = 0;
      for (let j = 0; j < 6; j++) s += Pg[i][j] * r[j];
      out[k * 6 + i] = s;
    }
  }
  return out;
}
