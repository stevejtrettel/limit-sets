/**
 * Small group-agnostic linear algebra utilities.
 *
 * Currently:
 *   jacobiSymmetricEig — eigendecomposition of a symmetric n×n matrix via
 *                        cyclic Jacobi rotations. Used by chart fitters and
 *                        anything else doing PCA-style work in low dim.
 */

/**
 * Symmetric eigendecomposition of an n×n real symmetric matrix M via cyclic
 * Jacobi rotations. Returns eigenvalues + column eigenvectors in the same
 * orthogonal frame; pairing is `(vals[i], vecs[i])`.
 *
 * Up to 100 sweeps; max-off-diagonal convergence threshold is 1e-14.
 * Intended for low dimensions (n ≤ ~10) where the cubic cost is irrelevant.
 */
export function jacobiSymmetricEig(
  M: number[][],
  n: number,
): { vals: number[]; vecs: number[][] } {
  const A = M.map((r) => r.slice());
  const V: number[][] = [];
  for (let j = 0; j < n; j++) {
    V.push(Array(n).fill(0));
    V[j][j] = 1;
  }

  for (let iter = 0; iter < 100; iter++) {
    let p = 0, q = 1, maxOff = Math.abs(A[0][1]);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (Math.abs(A[i][j]) > maxOff) {
          maxOff = Math.abs(A[i][j]);
          p = i;
          q = j;
        }
      }
    }
    if (maxOff < 1e-14) break;

    const tau = (A[q][q] - A[p][p]) / (2 * A[p][q]);
    const t = tau >= 0
      ? 1 / (tau + Math.sqrt(tau * tau + 1))
      : 1 / (tau - Math.sqrt(tau * tau + 1));
    const c = 1 / Math.sqrt(t * t + 1);
    const s = t * c;

    const Apq = A[p][q];
    A[p][p] -= t * Apq;
    A[q][q] += t * Apq;
    A[p][q] = 0;
    A[q][p] = 0;
    for (let i = 0; i < n; i++) {
      if (i !== p && i !== q) {
        const Aip = A[i][p];
        const Aiq = A[i][q];
        A[i][p] = c * Aip - s * Aiq;
        A[p][i] = A[i][p];
        A[i][q] = s * Aip + c * Aiq;
        A[q][i] = A[i][q];
      }
    }
    for (let j = 0; j < n; j++) {
      const Vjp = V[j][p];
      const Vjq = V[j][q];
      V[j][p] = c * Vjp - s * Vjq;
      V[j][q] = s * Vjp + c * Vjq;
    }
  }

  const vals = new Array<number>(n);
  for (let i = 0; i < n; i++) vals[i] = A[i][i];
  const vecs: number[][] = [];
  for (let i = 0; i < n; i++) {
    const v = new Array<number>(n);
    for (let j = 0; j < n; j++) v[j] = V[j][i];
    vecs.push(v);
  }
  return { vals, vecs };
}
