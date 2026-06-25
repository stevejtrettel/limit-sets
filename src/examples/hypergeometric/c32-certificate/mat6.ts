/**
 * Minimal 6×6 / length-6 linear algebra shared by the C-32 coordinate, copy,
 * and cone-membership code. One matmul / inverse lives here rather than a copy
 * per module.
 */

export const I6: number[][] = Array.from({ length: 6 }, (_, i) =>
  Array.from({ length: 6 }, (_, j) => (i === j ? 1 : 0)));

type Mat = readonly (readonly number[])[];

/** A·B (both 6×6). */
export function matmul6(A: Mat, B: Mat): number[][] {
  return Array.from({ length: 6 }, (_, i) =>
    Array.from({ length: 6 }, (_, j) => {
      let s = 0;
      for (let k = 0; k < 6; k++) s += A[i][k] * B[k][j];
      return s;
    }));
}

/** M·v (matrix times length-6 column vector). */
export function matvec6(M: Mat, v: readonly number[]): number[] {
  return M.map((row) => {
    let s = 0;
    for (let j = 0; j < 6; j++) s += row[j] * v[j];
    return s;
  });
}

/** Transpose of a 6×6. */
export function transpose6(M: Mat): number[][] {
  return Array.from({ length: 6 }, (_, i) => Array.from({ length: 6 }, (_, j) => M[j][i]));
}

/** Exact determinant by cofactor (Laplace) expansion — integer-safe, for small n. */
export function det(M: Mat): number {
  const n = M.length;
  if (n === 1) return M[0][0];
  let s = 0;
  for (let j = 0; j < n; j++) {
    const minor = M.slice(1).map((row) => row.filter((_, k) => k !== j));
    s += (j % 2 ? -1 : 1) * M[0][j] * det(minor);
  }
  return s;
}

/** Gauss–Jordan inverse of a 6×6 (partial pivoting). */
export function invert6(M: Mat): number[][] {
  const n = 6;
  const a = M.map((r) => r.slice());
  const inv: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r;
    [a[c], a[p]] = [a[p], a[c]];
    [inv[c], inv[p]] = [inv[p], inv[c]];
    const pv = a[c][c];
    for (let j = 0; j < n; j++) { a[c][j] /= pv; inv[c][j] /= pv; }
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = a[r][c];
      if (f === 0) continue;
      for (let j = 0; j < n; j++) { a[r][j] -= f * a[c][j]; inv[r][j] -= f * inv[c][j]; }
    }
  }
  return inv;
}
