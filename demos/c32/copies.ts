/**
 * Copies of the ping-pong cone K under u-basis group elements (Step 4b).
 *
 * A "copy" is a u-basis matrix g; the copy is the polytope g·K. Because g is a
 * linear isomorphism, g·K has the SAME 1-skeleton as K (topology.ts) — only the
 * vertex positions change (g·rᵢ). So one `coneEdges()` result serves every copy;
 * `rays.transformedRays(g)` gives a copy's rays in companion coords (P·g·rᵢ).
 *
 * Presets:
 *   base      K
 *   rotated   Sᵏ·K       k=0..5   the six order-6 rotations (the FD rosette)
 *   nested    T⁻¹Sᵏ·K    k=0..5   the branch images, each ⊆ K
 *
 * S and T⁻¹ are the u-basis signed shift / inverse transvection (paper §1;
 * verified P·S = B₀·P, S⁶ = −I). Whether a copy is *drawable* is chart-dependent
 * (boundedness gate in main.ts): in the u-basis e₀ chart only Δ₀ is bounded, so
 * rotated copies k≠0 are unbounded there (they need the rosette chart), while the
 * nested copies all sit inside K and are bounded.
 */

import { I6, matmul6 } from './mat6';

/** Signed cyclic shift S (u-basis): S eᵢ = −e_{i+1}, S e₅ = e₀, S⁶ = −I. */
export const S_U: readonly (readonly number[])[] = [
  [ 0,  0,  0,  0,  0,  1],
  [-1,  0,  0,  0,  0,  0],
  [ 0, -1,  0,  0,  0,  0],
  [ 0,  0, -1,  0,  0,  0],
  [ 0,  0,  0, -1,  0,  0],
  [ 0,  0,  0,  0, -1,  0],
];

/** Inverse transvection T⁻¹ (u-basis): row transvection on coordinate 0. */
export const T_INV_U: readonly (readonly number[])[] = [
  [1, -5, -11, -14, -11, -5],
  [0,  1,   0,   0,   0,  0],
  [0,  0,   1,   0,   0,  0],
  [0,  0,   0,   1,   0,  0],
  [0,  0,   0,   0,   1,  0],
  [0,  0,   0,   0,   0,  1],
];

/** Mᵏ for k ≥ 0 (M⁰ = I). */
function matpow(M: readonly (readonly number[])[], k: number): number[][] {
  let R = I6.map((r) => r.slice());
  for (let p = 0; p < k; p++) R = matmul6(M, R);
  return R;
}

export interface Copy {
  label: string;
  /** u-basis transform g; this copy is g·K. */
  g: number[][];
  edge: number;     // edge-tube color
  vertex: number;   // vertex-sphere color
  body: number;     // silhouette-body color
}

// Base K keeps the established two-tone look; the six rotations/branch images
// each get one distinct hue so copies are told apart.
const BASE_EDGE = 0x1f5f87, BASE_VERTEX = 0xe09650, BASE_BODY = 0x3789b8;
const ROSETTE = [0xd1342b, 0xe8830c, 0x2f9e44, 0x1971c2, 0x7048e8, 0xc2255c];

export function baseCopies(): Copy[] {
  return [{ label: 'K', g: I6.map((r) => r.slice()), edge: BASE_EDGE, vertex: BASE_VERTEX, body: BASE_BODY }];
}

export function rotatedCopies(): Copy[] {
  return [0, 1, 2, 3, 4, 5].map((k) => ({
    label: `S^${k}·K`, g: matpow(S_U, k),
    edge: ROSETTE[k], vertex: ROSETTE[k], body: ROSETTE[k],
  }));
}

export function nestedCopies(): Copy[] {
  return [0, 1, 2, 3, 4, 5].map((k) => ({
    label: `T⁻¹S^${k}·K`, g: matmul6(T_INV_U, matpow(S_U, k)),
    edge: ROSETTE[k], vertex: ROSETTE[k], body: ROSETTE[k],
  }));
}
