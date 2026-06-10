/**
 * Cone-membership coloring (Step 4 "coloring" mode).
 *
 * Instead of drawing a copy g·K, we color each limit-set point by which copy (if
 * any) contains it — default black. Containment is tested in ℝ⁶, so it is
 * chart-independent and unaffected by boundedness: the six rotated cones color
 * points in *any* view, even where their hulls cannot be drawn.
 *
 * Test. A point lies in g·K (K = {y : H y ≥ 0}, u-coords) iff g⁻¹y ∈ K. The
 * orbit is in companion coords x (y = P⁻¹x), so set w = g⁻¹P⁻¹x, orient by
 * sign(w₀) (K ⊂ {w₀>0}), and require H·w ≥ 0. Precompute per copy
 *   A   = g⁻¹·P⁻¹                    (so w = A·x)
 *   row0 = A₀                        (orientation sign on x)
 *   HA  = H·A   (each row hᵀA)       (facet covectors acting directly on x)
 * This is the left/right duality: the point moves by g⁻¹, i.e. the facets H move
 * by the right action H ↦ H·g⁻¹.
 */

import type { Orbit } from '@/core/orbit';
import type { SceneEmbedding } from '@/core/scene';
import { P } from './coords';
import { FACETS_H } from './facets';
import { invert6, matmul6 } from './mat6';

const P_INV = invert6(P);

export interface ConeTest {
  /** Row 0 of A = g⁻¹P⁻¹: gives sign(w₀) = sign(row0·x). */
  row0: number[];
  /** Facet covectors acting on companion x: rows of H·A. */
  HA: number[][];
}

/** Build the membership test for the copy g·K (g a u-basis transform). */
export function makeConeTest(g: readonly (readonly number[])[]): ConeTest {
  const A = matmul6(invert6(g), P_INV);           // w = A·x
  // (h·A)_j = Σ_m h[m]·A[m][j]   — row covector h times matrix A.
  const HA = FACETS_H.map((h) =>
    Array.from({ length: 6 }, (_, j) => {
      let s = 0;
      for (let m = 0; m < 6; m++) s += h[m] * A[m][j];
      return s;
    }));
  return { row0: A[0].slice(), HA };
}

const EPS = 1e-9;

/** Does the companion point at (x, off) lie in this cone copy? */
export function inCone(t: ConeTest, x: Float64Array, off: number): boolean {
  let w0 = 0;
  for (let j = 0; j < 6; j++) w0 += t.row0[j] * x[off + j];
  const sign = w0 >= 0 ? 1 : -1;
  for (const r of t.HA) {
    let d = 0;
    for (let j = 0; j < 6; j++) d += r[j] * x[off + j];
    if (sign * d < -EPS) return false;
  }
  return true;
}

export type RGB = readonly [number, number, number];
export interface ColoredCone { test: ConeTest; rgb: RGB; }

const BLACK: RGB = [0, 0, 0];

/** Color of the point at (x, off): the first containing cone's color, else black. */
export function colorAt(cones: readonly ColoredCone[], x: Float64Array, off: number): RGB {
  for (const c of cones) if (inCone(c.test, x, off)) return c.rgb;
  return BLACK;
}

/** 0xRRGGBB → [r, g, b] in 0..1. */
export function hexToRgb(hex: number): RGB {
  return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
}

export interface InstanceData {
  aPos: Float32Array;
  aColor: Float32Array;
  kept: number;
}

/** Like buildOrbitInstances, but colors each point by cone membership instead of
 *  a word-structure palette. One embed pass; companion vecs drive the color. */
export function buildMembershipInstances(
  embedding: SceneEmbedding,
  orbit: Orbit,
  cones: readonly ColoredCone[],
): InstanceData {
  const { count, vecs } = orbit;
  const stride = embedding.stateDim;

  const tmpPos = new Float64Array(count * 3);
  const keptIdx = new Uint32Array(count);
  let kept = 0;
  for (let i = 0; i < count; i++) {
    if (embedding.embed(vecs, i * stride, tmpPos, kept * 3)) {
      keptIdx[kept] = i;
      kept++;
    }
  }

  const aPos = new Float32Array(kept * 3);
  for (let k = 0; k < kept * 3; k++) aPos[k] = tmpPos[k];

  const aColor = new Float32Array(kept * 3);
  for (let k = 0; k < kept; k++) {
    const rgb = colorAt(cones, vecs, keptIdx[k] * stride);
    aColor[k * 3] = rgb[0];
    aColor[k * 3 + 1] = rgb[1];
    aColor[k * 3 + 2] = rgb[2];
  }

  return { aPos, aColor, kept };
}
