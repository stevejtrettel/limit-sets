/**
 * Scene embeddings for Möbius limit sets on CP¹.
 *
 *   sphereEmbedding — Hopf map (Re z, Im z, Re w, Im w) → (X, Y, Z) ∈ S² ⊂ R³.
 *                     The Riemann sphere itself. No chart singularity.
 *
 *   planeEmbedding  — stereographic z/w → (Re, Im, 0) ∈ R². Familiar
 *                     Indra's-Pearls flat view; skips points with |w| < EPS_W
 *                     (the affine chart's point-at-infinity).
 *
 * Both are *fixed maps* — no PCA fit, no data dependence. They satisfy the
 * generic `SceneEmbedding` interface and slot into all the same downstream
 * machinery (Projector, Camera, autofit, accumulator).
 *
 * For sphereEmbedding the formula
 *   (X, Y, Z) = (2 Re(z·w̄), 2 Im(z·w̄), |z|² − |w|²) / (|z|² + |w|²)
 * gives a unit-sphere point. With states already normalised to S³ (|z|²+|w|²=1)
 * the divide is a no-op, but we keep it so the embedding survives unnormalised
 * input.
 */

import type { SceneEmbedding } from '../core/scene.ts';

/** Drop points in the affine chart's neighborhood of ∞ (|w| ≈ 0). */
const EPS_W2 = 1e-12;

export const sphereEmbedding: SceneEmbedding = {
  stateDim: 4,
  label: 'sphere',
  pretty: 'Riemann sphere',
  embed(buf, off, out, outOff) {
    const zr = buf[off],     zi = buf[off + 1];
    const wr = buf[off + 2], wi = buf[off + 3];
    const zz = zr * zr + zi * zi;
    const ww = wr * wr + wi * wi;
    const s = zz + ww;
    if (s < 1e-30) return false;
    const inv = 1 / s;
    // z · w̄ = (zr + i zi)(wr − i wi) = (zr·wr + zi·wi) + i (zi·wr − zr·wi)
    out[outOff]     = 2 * (zr * wr + zi * wi) * inv;
    out[outOff + 1] = 2 * (zi * wr - zr * wi) * inv;
    out[outOff + 2] = (zz - ww) * inv;
    return true;
  },
};

export const planeEmbedding: SceneEmbedding = {
  stateDim: 4,
  label: 'plane',
  pretty: 'stereographic plane (z/w)',
  embed(buf, off, out, outOff) {
    const zr = buf[off],     zi = buf[off + 1];
    const wr = buf[off + 2], wi = buf[off + 3];
    const ww = wr * wr + wi * wi;
    if (ww < EPS_W2) return false;
    const inv = 1 / ww;
    // z / w = z · w̄ / |w|²
    out[outOff]     = (zr * wr + zi * wi) * inv;
    out[outOff + 1] = (zi * wr - zr * wi) * inv;
    out[outOff + 2] = 0;
    return true;
  },
};
