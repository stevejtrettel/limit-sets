/**
 * Small group-agnostic linear algebra utilities, in low dimension.
 *
 *   jacobiSymmetricEig — symmetric eigendecomposition via cyclic Jacobi
 *                        rotations (PCA-style work; chart fitters).
 *   charPoly           — characteristic polynomial of a general (non-symmetric)
 *                        real matrix, via Faddeev–LeVerrier.
 *   polyRoots          — all complex roots of a real polynomial, via
 *                        Durand–Kerner; sorted by descending modulus.
 *
 * Together `polyRoots(charPoly(M))` gives the full (complex) spectrum of any
 * real matrix — used by the loxodromic-word search and matrix audits. We avoid
 * power iteration for the spectrum because it cannot tell a parabolic eigenvalue
 * (λ = 1 exactly, with a Jordan block) from a weakly loxodromic one (λ slightly
 * above 1) at any finite iteration count; the characteristic polynomial is exact.
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

// ─── General (non-symmetric) spectrum: char poly + complex roots ─────────────

export interface Complex { re: number; im: number; }

/** |z| of a complex number. */
export const complexAbs = (z: Complex): number => Math.hypot(z.re, z.im);

/**
 * Monic characteristic polynomial of an n×n real matrix, by the
 * Faddeev–LeVerrier algorithm. Returns coefficients high-degree-first,
 * [1, c_{n-1}, …, c₀], so the polynomial is  λⁿ + c_{n-1}λ^{n-1} + … + c₀.
 */
export function charPoly(M: number[][]): number[] {
  const n = M.length;
  let Mk: number[][] = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  const c = [1];
  const matmul = (A: number[][], B: number[][]): number[][] => {
    const R: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
    for (let i = 0; i < n; i++) for (let k = 0; k < n; k++) { const a = A[i][k]; if (a) for (let j = 0; j < n; j++) R[i][j] += a * B[k][j]; }
    return R;
  };
  for (let k = 1; k <= n; k++) {
    Mk = matmul(M, Mk);
    let tr = 0; for (let i = 0; i < n; i++) tr += Mk[i][i];
    const ck = -tr / k;
    c.push(ck);
    for (let i = 0; i < n; i++) Mk[i][i] += ck;
  }
  return c;
}

/**
 * All complex roots of a monic real polynomial (coefficients high-degree-first,
 * leading 1) via the Durand–Kerner iteration, sorted by descending modulus.
 * Returns degree-many roots (with multiplicity), real ones having im ≈ 0.
 */
export function polyRoots(coef: number[]): Complex[] {
  const n = coef.length - 1;
  const evalP = (z: Complex): Complex => {
    let r: Complex = { re: coef[0], im: 0 };
    for (let i = 1; i <= n; i++) r = { re: r.re * z.re - r.im * z.im + coef[i], im: r.re * z.im + r.im * z.re };
    return r;
  };
  // Distinct, off-axis starting points so no two iterates collide on the real line.
  const z: Complex[] = Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i) / n + 0.4;
    return { re: 0.7 * Math.cos(a), im: 0.7 * Math.sin(a) };
  });
  for (let it = 0; it < 600; it++) {
    let step = 0;
    for (let i = 0; i < n; i++) {
      let d: Complex = { re: 1, im: 0 };
      for (let j = 0; j < n; j++) if (j !== i) {
        const dx = { re: z[i].re - z[j].re, im: z[i].im - z[j].im };
        d = { re: d.re * dx.re - d.im * dx.im, im: d.re * dx.im + d.im * dx.re };
      }
      const p = evalP(z[i]);
      const den = d.re * d.re + d.im * d.im;
      const q = { re: (p.re * d.re + p.im * d.im) / den, im: (p.im * d.re - p.re * d.im) / den };
      z[i] = { re: z[i].re - q.re, im: z[i].im - q.im };
      step = Math.max(step, complexAbs(q));
    }
    if (step < 1e-13) break;
  }
  return z.sort((a, b) => complexAbs(b) - complexAbs(a));
}
