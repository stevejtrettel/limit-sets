/**
 * Small dense COMPLEX matrices in low dimension, stored FLAT (row-major) in a
 * Float64Array with interleaved [re, im] pairs: entry (r, c) of an n×n matrix
 * lives at index 2·(r·n + c). The dimension is inferred from the length
 * (n = √(length/2)), so every routine is dimension-generic, exactly like the
 * real `core/matrix.ts` it mirrors.
 *
 * The interleaved layout is the SAME layout as the realified orbit state
 * vectors of a complex action (z ∈ Cⁿ ↔ [Re z₁, Im z₁, …] ∈ R²ⁿ), so the
 * complex pipeline speaks one representation end to end.
 *
 * Human-authored matrices use `cmat([[[re,im], …], …])`; everything downstream
 * consumes the flat form.
 */

/** Row-major n×n complex matrix, interleaved re/im; n = √(length/2). */
export type CMat = Float64Array;

/** One complex number as a [re, im] pair (authoring convenience). */
export type Cx = readonly [number, number];

/** Below this pivot modulus a matrix is treated as singular. */
const EPS_SINGULAR = 1e-15;

/** Side length n of a flat complex n×n matrix; throws if not square. */
export function cmatDim(M: CMat): number {
  const n = Math.round(Math.sqrt(M.length / 2));
  if (2 * n * n !== M.length) {
    throw new Error(`complex matrix length ${M.length} is not 2·n²`);
  }
  return n;
}

/** Build a flat complex n×n matrix from rows of [re, im] pairs:
 *  cmat([[[1,0],[0,0]], [[0,0],[1,0]]]) is the 2×2 identity. */
export function cmat(rows: readonly (readonly Cx[])[]): CMat {
  const n = rows.length;
  const out = new Float64Array(2 * n * n);
  for (let r = 0; r < n; r++) {
    if (rows[r].length !== n) {
      throw new Error(`row ${r} has length ${rows[r].length}, expected ${n} (must be square)`);
    }
    for (let c = 0; c < n; c++) {
      out[2 * (r * n + c)]     = rows[r][c][0];
      out[2 * (r * n + c) + 1] = rows[r][c][1];
    }
  }
  return out;
}

/** The complex n×n identity. */
export function cidentity(n: number): CMat {
  const I = new Float64Array(2 * n * n);
  for (let i = 0; i < n; i++) I[2 * (i * n + i)] = 1;
  return I;
}

/** Matrix product P·Q (dimensions inferred and checked equal). */
export function cmatMul(P: CMat, Q: CMat): CMat {
  const n = cmatDim(P);
  if (cmatDim(Q) !== n) throw new Error('cmatMul: dimension mismatch');
  const R = new Float64Array(2 * n * n);
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < n; k++) {
      const pr = P[2 * (i * n + k)], pi = P[2 * (i * n + k) + 1];
      if (pr === 0 && pi === 0) continue;
      for (let j = 0; j < n; j++) {
        const qr = Q[2 * (k * n + j)], qi = Q[2 * (k * n + j) + 1];
        R[2 * (i * n + j)]     += pr * qr - pi * qi;
        R[2 * (i * n + j) + 1] += pr * qi + pi * qr;
      }
    }
  }
  return R;
}

/** Matrix–vector product M·v, v an interleaved complex n-vector (length 2n). */
export function cmatVec(M: CMat, v: Float64Array): Float64Array {
  const n = cmatDim(M);
  if (v.length !== 2 * n) throw new Error('cmatVec: dimension mismatch');
  const out = new Float64Array(2 * n);
  for (let r = 0; r < n; r++) {
    let accR = 0, accI = 0;
    for (let c = 0; c < n; c++) {
      const mr = M[2 * (r * n + c)], mi = M[2 * (r * n + c) + 1];
      const vr = v[2 * c], vi = v[2 * c + 1];
      accR += mr * vr - mi * vi;
      accI += mr * vi + mi * vr;
    }
    out[2 * r] = accR; out[2 * r + 1] = accI;
  }
  return out;
}

/** Conjugate transpose M*. */
export function cmatAdjoint(M: CMat): CMat {
  const n = cmatDim(M);
  const R = new Float64Array(2 * n * n);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      R[2 * (c * n + r)]     =  M[2 * (r * n + c)];
      R[2 * (c * n + r) + 1] = -M[2 * (r * n + c) + 1];
    }
  }
  return R;
}

/** Entrywise difference A − B (dimensions assumed equal). */
export function cmatSub(A: CMat, B: CMat): CMat {
  if (A.length !== B.length) throw new Error('cmatSub: dimension mismatch');
  const R = new Float64Array(A.length);
  for (let i = 0; i < A.length; i++) R[i] = A[i] - B[i];
  return R;
}

/** Scalar multiple s·M for complex s = [re, im]. */
export function cmatScale(M: CMat, s: Cx): CMat {
  const R = new Float64Array(M.length);
  const sr = s[0], si = s[1];
  for (let i = 0; i < M.length; i += 2) {
    R[i]     = sr * M[i] - si * M[i + 1];
    R[i + 1] = sr * M[i + 1] + si * M[i];
  }
  return R;
}

/** max entry modulus — the norm used by parity / form-preservation checks. */
export function cmatMaxAbs(M: CMat): number {
  let m = 0;
  for (let i = 0; i < M.length; i += 2) {
    m = Math.max(m, Math.hypot(M[i], M[i + 1]));
  }
  return m;
}

/** Inverse via complex Gauss–Jordan elimination with partial pivoting (by
 *  modulus); throws if singular. Dimension-generic, mirrors `matInverse`. */
export function cmatInverse(M: CMat): CMat {
  const n = cmatDim(M);
  const A = Float64Array.from(M);
  const I = cidentity(n);
  const idx = (r: number, c: number): number => 2 * (r * n + c);
  for (let col = 0; col < n; col++) {
    let piv = col;
    let max = Math.hypot(A[idx(col, col)], A[idx(col, col) + 1]);
    for (let r = col + 1; r < n; r++) {
      const v = Math.hypot(A[idx(r, col)], A[idx(r, col) + 1]);
      if (v > max) { max = v; piv = r; }
    }
    if (max < EPS_SINGULAR) throw new Error('singular complex matrix; cannot invert');
    if (piv !== col) {
      for (let j = 0; j < 2 * n; j++) {
        let t = A[2 * col * n + j]; A[2 * col * n + j] = A[2 * piv * n + j]; A[2 * piv * n + j] = t;
        t = I[2 * col * n + j]; I[2 * col * n + j] = I[2 * piv * n + j]; I[2 * piv * n + j] = t;
      }
    }
    // Scale the pivot row by 1/pivot (complex reciprocal).
    const pr = A[idx(col, col)], pi = A[idx(col, col) + 1];
    const d = pr * pr + pi * pi;
    const rr = pr / d, ri = -pi / d;
    for (let j = 0; j < n; j++) {
      let xr = A[idx(col, j)], xi = A[idx(col, j) + 1];
      A[idx(col, j)] = xr * rr - xi * ri; A[idx(col, j) + 1] = xr * ri + xi * rr;
      xr = I[idx(col, j)]; xi = I[idx(col, j) + 1];
      I[idx(col, j)] = xr * rr - xi * ri; I[idx(col, j) + 1] = xr * ri + xi * rr;
    }
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const fr = A[idx(r, col)], fi = A[idx(r, col) + 1];
      if (fr === 0 && fi === 0) continue;
      for (let j = 0; j < n; j++) {
        let xr = A[idx(col, j)], xi = A[idx(col, j) + 1];
        A[idx(r, j)]     -= fr * xr - fi * xi;
        A[idx(r, j) + 1] -= fr * xi + fi * xr;
        xr = I[idx(col, j)]; xi = I[idx(col, j) + 1];
        I[idx(r, j)]     -= fr * xr - fi * xi;
        I[idx(r, j) + 1] -= fr * xi + fi * xr;
      }
    }
  }
  return I;
}
