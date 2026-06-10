/**
 * 3×3 SO(2,1) / linear-algebra helpers used by the james-marit-new pipeline:
 * multiply, subtract, scale, identity, determinant, inverse.
 *
 * In this demo the SO(2,1) ⊂ SL(3, R) generators are supplied directly (see
 * so21Rep.ts) rather than being lifted from a 2×2 Fuchsian rep through sym²,
 * so the old `sym2 : SL(2,R) → SL(3,R)` map lives no longer here. The form
 * those generators preserve is still Q(α, β, γ) = β² − αγ in basis (x², xy, y²).
 */

export type Vec3 = readonly [number, number, number];
export type Mat3R = readonly [Vec3, Vec3, Vec3];
export type MutMat3R = [[number, number, number], [number, number, number], [number, number, number]];

export const I3: Mat3R = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];

export function scale3(m: Mat3R, s: number): Mat3R {
  return [
    [s * m[0][0], s * m[0][1], s * m[0][2]],
    [s * m[1][0], s * m[1][1], s * m[1][2]],
    [s * m[2][0], s * m[2][1], s * m[2][2]],
  ];
}

export function sub3(a: Mat3R, b: Mat3R): Mat3R {
  return [
    [a[0][0] - b[0][0], a[0][1] - b[0][1], a[0][2] - b[0][2]],
    [a[1][0] - b[1][0], a[1][1] - b[1][1], a[1][2] - b[1][2]],
    [a[2][0] - b[2][0], a[2][1] - b[2][1], a[2][2] - b[2][2]],
  ];
}

export function mul3(a: Mat3R, b: Mat3R): Mat3R {
  const out: MutMat3R = [[0,0,0],[0,0,0],[0,0,0]];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      let s = 0;
      for (let k = 0; k < 3; k++) s += a[i][k] * b[k][j];
      out[i][j] = s;
    }
  }
  return out;
}

export function det3(m: Mat3R): number {
  return (
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
  );
}

/** Cofactor inverse; caller must ensure det ≠ 0. */
export function inv3(m: Mat3R): Mat3R {
  const d = det3(m);
  const inv = 1 / d;
  return [
    [ (m[1][1]*m[2][2] - m[1][2]*m[2][1]) * inv,
     -(m[0][1]*m[2][2] - m[0][2]*m[2][1]) * inv,
      (m[0][1]*m[1][2] - m[0][2]*m[1][1]) * inv ],
    [-(m[1][0]*m[2][2] - m[1][2]*m[2][0]) * inv,
      (m[0][0]*m[2][2] - m[0][2]*m[2][0]) * inv,
     -(m[0][0]*m[1][2] - m[0][2]*m[1][0]) * inv ],
    [ (m[1][0]*m[2][1] - m[1][1]*m[2][0]) * inv,
     -(m[0][0]*m[2][1] - m[0][1]*m[2][0]) * inv,
      (m[0][0]*m[1][1] - m[0][1]*m[1][0]) * inv ],
  ];
}
