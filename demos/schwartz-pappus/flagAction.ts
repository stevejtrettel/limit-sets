/**
 * Flag-variety actions for SL(3,R) reps.
 *
 *   makeFlagMat3Action(M)   — 6-dim state [p, n] where p ∈ R³ is a point
 *                             representative and n ∈ R³ is a line-normal
 *                             representative. Per generator g, apply does
 *                                 p ←  M_g · p
 *                                 n ←  M_g⁻ᵀ · n
 *                             (the contragredient / dual action on line
 *                             normals). Normalises both halves to unit S²
 *                             per step, which lifts the line direction
 *                             from RP² to S² (sign-preserved by linear ops)
 *                             so the angle θ in flagEmbedding has range
 *                             [-π, π) with only one wraparound discontinuity
 *                             instead of two.
 *
 *   makeDualMat3Action(M)   — 3-dim state, apply: v ← M_g⁻ᵀ · v.
 *                             Used to power-iterate the LINE basepoint
 *                             n₀ = top eigenvector of ρ(γ)⁻ᵀ. Caller must
 *                             power-iterate with REVERSED γ (since the
 *                             walker reads words right-to-left and the
 *                             inverse transpose flips the product order):
 *                                 ρ(γ)⁻ᵀ = (M_{γₖ} ··· M_{γ₀})⁻ᵀ
 *                                        = M_{γ₀}⁻ᵀ ··· M_{γₖ}⁻ᵀ.
 *
 * Self-contained on purpose: only type imports from @/ (erased), all
 * 3×3 helpers inlined, so this file can be imported from the Node-run
 * render script (which doesn't resolve Vite @/ aliases at runtime).
 */

import type { GroupAction } from '@/core/group';
import type { Mat3R } from '@/sl3r/action';

// ─── 3×3 helpers (inlined; mirror matrices.ts but no cross-file deps) ───────

function mat3Det(M: Mat3R): number {
  const a = M[0][0], b = M[0][1], c = M[0][2];
  const d = M[1][0], e = M[1][1], f = M[1][2];
  const g = M[2][0], h = M[2][1], i = M[2][2];
  return a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
}

function mat3Inv(M: Mat3R): Mat3R {
  const a = M[0][0], b = M[0][1], c = M[0][2];
  const d = M[1][0], e = M[1][1], f = M[1][2];
  const g = M[2][0], h = M[2][1], i = M[2][2];
  const det = mat3Det(M);
  if (Math.abs(det) < 1e-15) {
    throw new Error('mat3Inv: singular 3×3');
  }
  const inv = 1 / det;
  return [
    [ (e * i - f * h) * inv, -(b * i - c * h) * inv,  (b * f - c * e) * inv],
    [-(d * i - f * g) * inv,  (a * i - c * g) * inv, -(a * f - c * d) * inv],
    [ (d * h - e * g) * inv, -(a * h - b * g) * inv,  (a * e - b * d) * inv],
  ];
}

function normalize3At(buf: Float64Array, off: number): void {
  const x = buf[off], y = buf[off + 1], z = buf[off + 2];
  const s = x * x + y * y + z * z;
  if (s === 0) return;
  const inv = 1 / Math.sqrt(s);
  buf[off]     = x * inv;
  buf[off + 1] = y * inv;
  buf[off + 2] = z * inv;
}

function normalizeFlag(buf: Float64Array, off: number): void {
  normalize3At(buf, off);
  normalize3At(buf, off + 3);
}

// ─── Flag action (6-dim state) ──────────────────────────────────────────────

/**
 * Free-product (F₂-style) walker with letters {g₁, g₁⁻¹, g₂, g₂⁻¹, ...},
 * acting on 6-dim state [p, n] by (p, n) ↦ (M_g·p, M_g⁻ᵀ·n).
 *
 * Letter encoding matches sl3r's makeMat3Action({involutions:false}):
 *   letter 2k   = g_k  (matrix M_k)
 *   letter 2k+1 = g_k⁻¹ (matrix M_k⁻¹)
 * For the dual action, the corresponding line-normal matrices are
 *   letter 2k   → (M_k)⁻ᵀ
 *   letter 2k+1 → (M_k⁻¹)⁻ᵀ = (M_k)ᵀ
 */
export function makeFlagMat3Action(matrices: readonly Mat3R[]): GroupAction {
  const N = matrices.length;
  const numGen = 2 * N;
  if (numGen > 255) {
    throw new Error(`makeFlagMat3Action: too many generators (${numGen}); cap is 255`);
  }

  const inverse = new Uint8Array(numGen);
  for (let k = 0; k < N; k++) {
    inverse[2 * k]     = 2 * k + 1;
    inverse[2 * k + 1] = 2 * k;
  }

  // Two flat tables of 9 doubles per letter:
  //   mats[g]    = M for the point action
  //   matsIT[g]  = M⁻ᵀ for the line-normal action
  const mats   = new Float64Array(numGen * 9);
  const matsIT = new Float64Array(numGen * 9);

  for (let k = 0; k < N; k++) {
    const M    = matrices[k];
    const Minv = mat3Inv(M);

    // Letter 2k: point ← M, normal ← M⁻ᵀ = transpose(M⁻¹).
    const off = 2 * k * 9;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      mats[off + r * 3 + c]   = M[r][c];
      matsIT[off + r * 3 + c] = Minv[c][r]; // transpose
    }

    // Letter 2k+1 (inverse): point ← M⁻¹, normal ← (M⁻¹)⁻ᵀ = Mᵀ.
    const offI = (2 * k + 1) * 9;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      mats[offI + r * 3 + c]   = Minv[r][c];
      matsIT[offI + r * 3 + c] = M[c][r]; // transpose
    }
  }

  function apply(
    gen: number,
    src: Float64Array, sOff: number,
    dst: Float64Array, dOff: number,
  ): void {
    const m = gen * 9;
    const px = src[sOff], py = src[sOff + 1], pz = src[sOff + 2];
    const nx = src[sOff + 3], ny = src[sOff + 4], nz = src[sOff + 5];
    // p ← M · p
    dst[dOff]     = mats[m]     * px + mats[m + 1] * py + mats[m + 2] * pz;
    dst[dOff + 1] = mats[m + 3] * px + mats[m + 4] * py + mats[m + 5] * pz;
    dst[dOff + 2] = mats[m + 6] * px + mats[m + 7] * py + mats[m + 8] * pz;
    // n ← M⁻ᵀ · n
    dst[dOff + 3] = matsIT[m]     * nx + matsIT[m + 1] * ny + matsIT[m + 2] * nz;
    dst[dOff + 4] = matsIT[m + 3] * nx + matsIT[m + 4] * ny + matsIT[m + 5] * nz;
    dst[dOff + 5] = matsIT[m + 6] * nx + matsIT[m + 7] * ny + matsIT[m + 8] * nz;
  }

  return {
    numGenerators: numGen,
    stateDim:      6,
    inverse,
    apply,
    normalize:     normalizeFlag,
  };
}

// ─── Dual action (3-dim) — only used for the line-basepoint power iteration ─

/**
 * letter 2k → M_k⁻ᵀ, letter 2k+1 → M_kᵀ. Used inside the demo to
 * power-iterate the line basepoint n₀ = top eigenvector of ρ(γ)⁻ᵀ.
 *
 * IMPORTANT: caller must power-iterate with REVERSED γ. The walker
 * convention is right-to-left product (applyWord([w₀, …, wₖ₋₁]) gives
 * M_{wₖ₋₁} ⋯ M_{w₀}), so to compute (ρ(γ))⁻ᵀ = M_{γ₀}⁻ᵀ ⋯ M_{γₖ₋₁}⁻ᵀ
 * we feed in reversed γ with the dual letters (which encode the ⁻ᵀ).
 */
export function makeDualMat3Action(matrices: readonly Mat3R[]): GroupAction {
  const N = matrices.length;
  const numGen = 2 * N;
  if (numGen > 255) {
    throw new Error(`makeDualMat3Action: too many generators (${numGen}); cap is 255`);
  }

  const inverse = new Uint8Array(numGen);
  for (let k = 0; k < N; k++) {
    inverse[2 * k]     = 2 * k + 1;
    inverse[2 * k + 1] = 2 * k;
  }

  const mats = new Float64Array(numGen * 9);
  for (let k = 0; k < N; k++) {
    const M    = matrices[k];
    const Minv = mat3Inv(M);
    // Letter 2k = M⁻ᵀ
    const off = 2 * k * 9;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      mats[off + r * 3 + c] = Minv[c][r];
    }
    // Letter 2k+1 = Mᵀ
    const offI = (2 * k + 1) * 9;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      mats[offI + r * 3 + c] = M[c][r];
    }
  }

  function apply(
    gen: number,
    src: Float64Array, sOff: number,
    dst: Float64Array, dOff: number,
  ): void {
    const m = gen * 9;
    const x = src[sOff], y = src[sOff + 1], z = src[sOff + 2];
    dst[dOff]     = mats[m]     * x + mats[m + 1] * y + mats[m + 2] * z;
    dst[dOff + 1] = mats[m + 3] * x + mats[m + 4] * y + mats[m + 5] * z;
    dst[dOff + 2] = mats[m + 6] * x + mats[m + 7] * y + mats[m + 8] * z;
  }

  return {
    numGenerators: numGen,
    stateDim:      3,
    inverse,
    apply,
    normalize:     normalize3At,
  };
}
