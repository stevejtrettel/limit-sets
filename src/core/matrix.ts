/**
 * Small dense real matrices in low dimension, stored FLAT (row-major) in a
 * Float64Array. The dimension n is inferred from the length (n = √length), so
 * every routine here is dimension-generic — one `matMul`, one `matInverse`, one
 * `companion` serve dims 2..6 alike. This is the single matrix representation
 * shared with the orbit state vectors (also flat Float64Arrays), so the whole
 * pipeline speaks one layout.
 *
 * Human-authored matrices use `mat([[…], …])` for readability; everything
 * downstream consumes the flat form.
 *
 * Replaces the per-family matrix helpers: o5's companion/companionInverse/mul5,
 * sl3r's mat3Det/mat3Inverse, sl4r's mat4Det/mat4Mul/mat4Inverse, and
 * schwartz-pappus's mat3Mul/mat3Inv/mat3Trace.
 */

/** Row-major n×n matrix; n = √length. */
export type Mat = Float64Array;

/** Below this |det| a matrix is treated as singular. */
const EPS_SINGULAR = 1e-15;

/** Side length n of a flat n×n matrix; throws if the length is not square. */
export function matDim(M: Mat): number {
  const n = Math.round(Math.sqrt(M.length));
  if (n * n !== M.length) {
    throw new Error(`matrix length ${M.length} is not a perfect square`);
  }
  return n;
}

/** Build a flat n×n matrix from human-readable rows: mat([[1,0],[0,1]]). */
export function mat(rows: readonly (readonly number[])[]): Mat {
  const n = rows.length;
  const out = new Float64Array(n * n);
  for (let r = 0; r < n; r++) {
    if (rows[r].length !== n) {
      throw new Error(`row ${r} has length ${rows[r].length}, expected ${n} (must be square)`);
    }
    for (let c = 0; c < n; c++) out[r * n + c] = rows[r][c];
  }
  return out;
}

/** The n×n identity. */
export function identity(n: number): Mat {
  const I = new Float64Array(n * n);
  for (let i = 0; i < n; i++) I[i * n + i] = 1;
  return I;
}

/** Matrix product P·Q (dimensions inferred and checked equal). */
export function matMul(P: Mat, Q: Mat): Mat {
  const n = matDim(P);
  if (matDim(Q) !== n) throw new Error('matMul: dimension mismatch');
  const R = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < n; k++) {
      const p = P[i * n + k];
      if (p === 0) continue;
      for (let j = 0; j < n; j++) R[i * n + j] += p * Q[k * n + j];
    }
  }
  return R;
}

/** Trace (sum of the diagonal). */
export function matTrace(M: Mat): number {
  const n = matDim(M);
  let t = 0;
  for (let i = 0; i < n; i++) t += M[i * n + i];
  return t;
}

/** Determinant via Gaussian elimination with partial pivoting. */
export function matDet(M: Mat): number {
  const n = matDim(M);
  const A = Float64Array.from(M);
  let det = 1;
  for (let col = 0; col < n; col++) {
    let piv = col;
    let max = Math.abs(A[col * n + col]);
    for (let r = col + 1; r < n; r++) {
      const v = Math.abs(A[r * n + col]);
      if (v > max) { max = v; piv = r; }
    }
    if (max < EPS_SINGULAR) return 0;
    if (piv !== col) {
      for (let j = 0; j < n; j++) {
        const t = A[col * n + j]; A[col * n + j] = A[piv * n + j]; A[piv * n + j] = t;
      }
      det = -det;
    }
    const pivot = A[col * n + col];
    det *= pivot;
    for (let r = col + 1; r < n; r++) {
      const factor = A[r * n + col] / pivot;
      if (factor === 0) continue;
      for (let j = col; j < n; j++) A[r * n + j] -= factor * A[col * n + j];
    }
  }
  return det;
}

/** Inverse via Gauss–Jordan elimination with partial pivoting; throws if
 *  singular. Dimension-generic — replaces every hand-rolled n×n cofactor
 *  inverse in the per-family modules. */
export function matInverse(M: Mat): Mat {
  const n = matDim(M);
  const A = Float64Array.from(M);
  const I = identity(n);
  for (let col = 0; col < n; col++) {
    let piv = col;
    let max = Math.abs(A[col * n + col]);
    for (let r = col + 1; r < n; r++) {
      const v = Math.abs(A[r * n + col]);
      if (v > max) { max = v; piv = r; }
    }
    if (max < EPS_SINGULAR) throw new Error('singular matrix; cannot invert');
    if (piv !== col) {
      for (let j = 0; j < n; j++) {
        let t = A[col * n + j]; A[col * n + j] = A[piv * n + j]; A[piv * n + j] = t;
        t = I[col * n + j]; I[col * n + j] = I[piv * n + j]; I[piv * n + j] = t;
      }
    }
    const invPivot = 1 / A[col * n + col];
    for (let j = 0; j < n; j++) { A[col * n + j] *= invPivot; I[col * n + j] *= invPivot; }
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = A[r * n + col];
      if (factor === 0) continue;
      for (let j = 0; j < n; j++) {
        A[r * n + j] -= factor * A[col * n + j];
        I[r * n + j] -= factor * I[col * n + j];
      }
    }
  }
  return I;
}

/**
 * Companion matrix of a monic polynomial given high-degree-first coefficients
 *   coeff = [1, c_{n-1}, …, c₁, c₀]   (length n+1, leading entry 1),
 * i.e. p(x) = xⁿ + c_{n-1}x^{n-1} + … + c₁x + c₀. The returned C satisfies
 *   C·e_j = e_{j+1}  (j = 0..n-2),   last column = −(c₀, c₁, …, c_{n-1})ᵀ.
 * (Convention lifted verbatim from the original o5/action.ts; for palindromic
 * coefficient lists the indexing direction is moot.)
 */
export function companion(coeff: readonly number[]): Mat {
  const n = coeff.length - 1;
  if (coeff[0] !== 1) {
    throw new Error('companion: expected a monic polynomial (leading coefficient 1)');
  }
  const C = new Float64Array(n * n);
  for (let j = 0; j < n - 1; j++) C[(j + 1) * n + j] = 1; // C·e_j = e_{j+1}
  for (let r = 0; r < n; r++) C[r * n + (n - 1)] = -coeff[n - r]; // last column = −(c₀…c_{n-1})
  return C;
}
