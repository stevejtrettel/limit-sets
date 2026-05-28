/**
 * Scene embeddings for SL(3,R) limit sets on RP² (sphere-cover model).
 *
 *   sphereEmbedding — identity (state is already a point on S² after the
 *                     action's normalize step). Shows S² in 3D scene,
 *                     so antipodal copies of the convex domain both appear.
 *
 *   planeEmbedding  — affine chart (x, y, z) → (x/z, y/z, 0). The familiar
 *                     "Klein-disk-style" picture for convex projective
 *                     structures. Skips points near the chart-at-infinity
 *                     line {|z| < EPS_Z}.
 *
 * For convex projective triangle groups, the planeEmbedding is the natural
 * view — the convex domain Ω ⊂ RP² lifts to a bounded convex set in R²,
 * the limit set is its boundary curve.
 */

import type { SceneEmbedding } from '../core/scene.ts';

export const sphereEmbedding: SceneEmbedding = {
  stateDim: 3,
  label: 'sphere',
  pretty: 'unit S² (projective sphere)',
  embed(buf, off, out, outOff) {
    out[outOff]     = buf[off];
    out[outOff + 1] = buf[off + 1];
    out[outOff + 2] = buf[off + 2];
    return true;
  },
};

const EPS_Z = 1e-6;

export const planeEmbedding: SceneEmbedding = {
  stateDim: 3,
  label: 'plane',
  pretty: 'affine chart (x/z, y/z)',
  embed(buf, off, out, outOff) {
    const z = buf[off + 2];
    if (Math.abs(z) < EPS_Z) return false;
    const inv = 1 / z;
    out[outOff]     = buf[off]     * inv;
    out[outOff + 1] = buf[off + 1] * inv;
    out[outOff + 2] = 0;
    return true;
  },
};
