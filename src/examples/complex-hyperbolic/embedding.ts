/**
 * Scene embeddings for limit sets on ∂CH² = S³ (states in C³ ↔ R⁶).
 *
 *   stereographicEmbedding — the literal "limit set in the 3-sphere" picture:
 *       null vector → w = (z₁/z₃, z₂/z₃) ∈ S³ ⊂ C² ≅ R⁴, renormalized onto
 *       the unit sphere, then stereographic projection from the pole
 *       w = (0, i) to R³. On the null cone z₃ never vanishes (|z₃|² = |z₁|² +
 *       |z₂|²), so the affine chart is globally good; only points near the
 *       projection pole are skipped.
 *
 *   heisenbergEmbedding — the Siegel-domain picture standard in the
 *       Goldman–Parker / Falbel–Parker literature: Cayley-translate to the
 *       second Hermitian form (Z₁,Z₂,Z₃) = ((z₁+z₃)/√2, z₂, (z₁−z₃)/√2) and
 *       read Heisenberg coordinates (Re ζ, Im ζ, v) with ζ = Z₂/Z₃,
 *       v = 2·Im(Z₁/Z₃). The boundary minus one point (w = (1,0), sent to ∞)
 *       is the Heisenberg group; C-circles through ∞ appear as vertical
 *       chains, R-circles as horizontal curves.
 *
 * Both are fixed, parameter-free maps (no PCA), and both are PHASE-INVARIANT
 * (they only use ratios of coordinates), as required for states that live on
 * the circle-bundle cover S⁵ → CP².
 */

import type { SceneEmbedding } from '../../core/scene.ts';

/** Skip states this close to a chart singularity (relative scale). */
const EPS2 = 1e-18;
/** Skip S³ points this close to the stereographic pole. */
const EPS_POLE = 1e-7;

export const stereographicEmbedding: SceneEmbedding = {
  stateDim: 6,
  label: 'sphere-stereo',
  pretty: 'S³ ⊂ C², stereographic from (0, i)',
  embed(buf, off, out, outOff) {
    const z1r = buf[off],     z1i = buf[off + 1];
    const z2r = buf[off + 2], z2i = buf[off + 3];
    const z3r = buf[off + 4], z3i = buf[off + 5];
    const d = z3r * z3r + z3i * z3i;
    if (d < EPS2) return false;
    const inv = 1 / d;
    // w_k = z_k / z₃ = z_k · z̄₃ / |z₃|²
    const x1 = (z1r * z3r + z1i * z3i) * inv, y1 = (z1i * z3r - z1r * z3i) * inv;
    const x2 = (z2r * z3r + z2i * z3i) * inv, y2 = (z2i * z3r - z2r * z3i) * inv;
    // Renormalize onto S³ (a no-op on the null cone; heals Float64 drift).
    const s = x1 * x1 + y1 * y1 + x2 * x2 + y2 * y2;
    if (s < EPS2) return false;
    const r = 1 / Math.sqrt(s);
    const denom = 1 - y2 * r;                 // pole at (x₁,y₁,x₂,y₂) = (0,0,0,1)
    if (Math.abs(denom) < EPS_POLE) return false;
    const k = r / denom;
    // Axis order (x₁, x₂, y₁): the standard R-circle {w real, |w|=1} — and the
    // near-R-circle Goldman–Parker family with it — lands in the z = 0 plane,
    // facing the offline renderer's top-down auto camera.
    out[outOff]     = x1 * k;
    out[outOff + 1] = x2 * k;
    out[outOff + 2] = y1 * k;
    return true;
  },
};

const R2 = Math.SQRT1_2; // 1/√2

export const heisenbergEmbedding: SceneEmbedding = {
  stateDim: 6,
  label: 'heisenberg',
  pretty: 'Heisenberg group (Re ζ, Im ζ, v)',
  embed(buf, off, out, outOff) {
    const z1r = buf[off],     z1i = buf[off + 1];
    const z2r = buf[off + 2], z2i = buf[off + 3];
    const z3r = buf[off + 4], z3i = buf[off + 5];
    // Cayley: Z₁ = (z₁+z₃)/√2, Z₂ = z₂, Z₃ = (z₁−z₃)/√2.
    const Z1r = (z1r + z3r) * R2, Z1i = (z1i + z3i) * R2;
    const Z3r = (z1r - z3r) * R2, Z3i = (z1i - z3i) * R2;
    const d = Z3r * Z3r + Z3i * Z3i;
    // Relative cutoff: near w = (1, 0) the point is at Heisenberg ∞.
    let norm2 = 0;
    for (let i = 0; i < 6; i++) norm2 += buf[off + i] * buf[off + i];
    if (d < 1e-12 * norm2) return false;
    const inv = 1 / d;
    // ζ = Z₂/Z₃, v = 2·Im(Z₁/Z₃)
    out[outOff]     = (z2r * Z3r + z2i * Z3i) * inv;
    out[outOff + 1] = (z2i * Z3r - z2r * Z3i) * inv;
    out[outOff + 2] = 2 * (Z1i * Z3r - Z1r * Z3i) * inv;
    return true;
  },
};
