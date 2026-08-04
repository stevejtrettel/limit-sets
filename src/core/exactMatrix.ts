/**
 * Exact integer / rational linear algebra.
 *
 * The float path (`core/matrix.ts`, `core/linalg.ts`) is what the orbit hot loop
 * and the charts want. This module is for the other half of the work: CERTIFYING
 * a construction. Several families here are defined over ℤ — companion matrices
 * of integer polynomials, integral quadratic forms, change-of-basis matrices with
 * integer entries — and for those, claims like "this matrix is an involution",
 * "this form is preserved", "the signature is (p,q)" deserve to be decided rather
 * than compared against a tolerance.
 *
 * Two layers:
 *   • IMat — integer matrices (`bigint[][]`). Products, determinant (Bareiss,
 *     fraction-free so no rationals appear), rank.
 *   • FMat — rational matrices (`Frac[][]`). Inversion and symmetric-congruence
 *     diagonalization, which integers alone cannot express.
 *
 * The determinant is Bareiss rather than cofactor expansion: every intermediate
 * is itself a minor of the original matrix, so it stays integral and the entries
 * stay small enough to be practical at the sizes here (d ≤ 25).
 *
 * `signatureOfSymmetric` diagonalizes by CONGRUENCE (M ↦ EᵀME), which is the
 * operation that preserves a quadratic form's signature — as opposed to
 * similarity, which preserves eigenvalues. Sylvester's law of inertia says the
 * resulting diagonal's sign pattern is an invariant, so counting signs decides
 * the signature exactly. This avoids the trap that sank a numeric attempt at the
 * same question: a symmetric eigensolver on a form whose entries span many orders
 * of magnitude puts near-zero eigenvalues on the wrong side of zero, silently
 * reporting the wrong signature.
 *
 * Pure ability — no example data, no family constants.
 */

/** Integer matrix, row-major as rows of bigints. */
export type IMat = bigint[][];

/** Exact rational, always normalized: `den > 0` and gcd(|num|, den) = 1. */
export interface Frac { num: bigint; den: bigint }

/** Rational matrix. */
export type FMat = Frac[][];

// ─── integer matrices ────────────────────────────────────────────────────────

const absB = (x: bigint): bigint => (x < 0n ? -x : x);

export function gcdB(a: bigint, b: bigint): bigint {
  a = absB(a); b = absB(b);
  while (b) { const t = a % b; a = b; b = t; }
  return a;
}

export const izeros = (rows: number, cols = rows): IMat =>
  Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0n));

export const iident = (n: number): IMat =>
  Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1n : 0n)));

export function imul(X: IMat, Y: IMat): IMat {
  const rows = X.length, inner = Y.length, cols = Y[0].length;
  const out = izeros(rows, cols);
  for (let i = 0; i < rows; i++) {
    for (let k = 0; k < inner; k++) {
      const x = X[i][k];
      if (x === 0n) continue;
      for (let j = 0; j < cols; j++) out[i][j] += x * Y[k][j];
    }
  }
  return out;
}

export const itranspose = (X: IMat): IMat =>
  X[0].map((_, j) => X.map((row) => row[j]));

export const isub = (X: IMat, Y: IMat): IMat =>
  X.map((row, i) => row.map((v, j) => v - Y[i][j]));

/** Add `c` to every diagonal entry (i.e. X + cI). */
export const iaddScalar = (X: IMat, c: bigint): IMat =>
  X.map((row, i) => row.map((v, j) => (i === j ? v + c : v)));

export const iequal = (X: IMat, Y: IMat): boolean =>
  X.length === Y.length && X.every((row, i) => row.every((v, j) => v === Y[i][j]));

export const iisZero = (X: IMat): boolean => X.every((row) => row.every((v) => v === 0n));

/** X^e for e ≥ 0. */
export function ipow(X: IMat, e: number): IMat {
  let acc = iident(X.length);
  let base = X.map((r) => r.slice());
  let k = e;
  while (k > 0) {
    if (k & 1) acc = imul(acc, base);
    base = imul(base, base);
    k >>= 1;
  }
  return acc;
}

/** Greatest common divisor of all entries (0 for the zero matrix). */
export function icontent(X: IMat): bigint {
  let g = 0n;
  for (const row of X) for (const v of row) g = gcdB(g, v);
  return g;
}

/** Divide out the content, returning the primitive matrix and the factor removed. */
export function iprimitive(X: IMat): { M: IMat; content: bigint } {
  const g = icontent(X);
  if (g === 0n || g === 1n) return { M: X.map((r) => r.slice()), content: g };
  return { M: X.map((r) => r.map((v) => v / g)), content: g };
}

/** Determinant by fraction-free (Bareiss) elimination. Exact, stays integral. */
export function idet(M: IMat): bigint {
  const n = M.length;
  if (n === 0) return 1n;
  const A = M.map((r) => r.slice());
  let sign = 1n, prev = 1n;
  for (let k = 0; k < n - 1; k++) {
    if (A[k][k] === 0n) {
      let p = -1;
      for (let i = k + 1; i < n; i++) if (A[i][k] !== 0n) { p = i; break; }
      if (p === -1) return 0n;
      [A[k], A[p]] = [A[p], A[k]];
      sign = -sign;
    }
    for (let i = k + 1; i < n; i++) {
      for (let j = k + 1; j < n; j++) {
        A[i][j] = (A[i][j] * A[k][k] - A[i][k] * A[k][j]) / prev;
      }
    }
    prev = A[k][k];
  }
  return sign * A[n - 1][n - 1];
}

/** Rank by fraction-free elimination. */
export function irank(M: IMat): number {
  if (M.length === 0) return 0;
  const A = M.map((r) => r.slice());
  const rows = A.length, cols = A[0].length;
  let rank = 0;
  for (let c = 0, r = 0; c < cols && r < rows; c++) {
    let p = -1;
    for (let i = r; i < rows; i++) if (A[i][c] !== 0n) { p = i; break; }
    if (p === -1) continue;
    [A[r], A[p]] = [A[p], A[r]];
    for (let i = r + 1; i < rows; i++) {
      if (A[i][c] === 0n) continue;
      const a = A[r][c], b = A[i][c];
      for (let j = c; j < cols; j++) A[i][j] = A[i][j] * a - A[r][j] * b;
    }
    r++; rank++;
  }
  return rank;
}

// ─── rationals ───────────────────────────────────────────────────────────────

export function frac(num: bigint, den: bigint = 1n): Frac {
  if (den === 0n) throw new Error('exactMatrix: zero denominator');
  if (den < 0n) { num = -num; den = -den; }
  const g = gcdB(num, den);
  return g > 1n ? { num: num / g, den: den / g } : { num, den };
}

export const fadd = (a: Frac, b: Frac): Frac => frac(a.num * b.den + b.num * a.den, a.den * b.den);
export const fsub = (a: Frac, b: Frac): Frac => frac(a.num * b.den - b.num * a.den, a.den * b.den);
export const fmul = (a: Frac, b: Frac): Frac => frac(a.num * b.num, a.den * b.den);
export const fdiv = (a: Frac, b: Frac): Frac => {
  if (b.num === 0n) throw new Error('exactMatrix: division by zero');
  return frac(a.num * b.den, a.den * b.num);
};
export const fsign = (a: Frac): number => (a.num > 0n ? 1 : a.num < 0n ? -1 : 0);
export const fisZero = (a: Frac): boolean => a.num === 0n;

export const ftoNumber = (a: Frac): number => Number(a.num) / Number(a.den);

export const ifromInt = (X: IMat): FMat => X.map((row) => row.map((v) => frac(v)));

/**
 * Clear denominators: return an integer matrix and the scalar `k` with
 * `intMatrix = k · X`. `k` is the lcm of the entry denominators.
 */
export function fclearDenominators(X: FMat): { M: IMat; scale: bigint } {
  let l = 1n;
  for (const row of X) for (const v of row) l = (l / gcdB(l, v.den)) * v.den;
  return { M: X.map((row) => row.map((v) => v.num * (l / v.den))), scale: l };
}

/**
 * Exact kernel (null space) of an integer matrix, as a basis of PRIMITIVE
 * integer vectors: Gauss-Jordan RREF over ℚ, one basis vector per free column,
 * denominators cleared and content divided out. Empty array ⟺ injective.
 */
export function ikernel(M: IMat): bigint[][] {
  const rows = M.length;
  if (rows === 0) throw new Error('ikernel: no rows (kernel dimension is unconstrained)');
  const cols = M[0].length;
  const A: FMat = M.map((r) => r.map((v) => frac(v)));

  // RREF, recording the pivot column of each pivot row.
  const pivotCol: number[] = [];
  let r = 0;
  for (let c = 0; c < cols && r < rows; c++) {
    let p = -1;
    for (let i = r; i < rows; i++) if (!fisZero(A[i][c])) { p = i; break; }
    if (p === -1) continue;
    [A[r], A[p]] = [A[p], A[r]];
    const piv = A[r][c];
    for (let j = 0; j < cols; j++) A[r][j] = fdiv(A[r][j], piv);
    for (let i = 0; i < rows; i++) {
      if (i === r || fisZero(A[i][c])) continue;
      const f = A[i][c];
      for (let j = 0; j < cols; j++) A[i][j] = fsub(A[i][j], fmul(f, A[r][j]));
    }
    pivotCol.push(c);
    r++;
  }

  // One kernel vector per free column: free coordinate 1, pivots back-filled.
  const isPivot = new Set(pivotCol);
  const basis: bigint[][] = [];
  for (let c = 0; c < cols; c++) {
    if (isPivot.has(c)) continue;
    const v: Frac[] = Array.from({ length: cols }, () => frac(0n));
    v[c] = frac(1n);
    for (let i = 0; i < pivotCol.length; i++) v[pivotCol[i]] = fsub(frac(0n), A[i][c]);
    let l = 1n;
    for (const x of v) l = (l / gcdB(l, x.den)) * x.den;
    const ints = v.map((x) => x.num * (l / x.den));
    let g = 0n;
    for (const x of ints) g = gcdB(g, x);
    basis.push(g > 1n ? ints.map((x) => x / g) : ints);
  }
  return basis;
}

/** Exact inverse by Gauss-Jordan over ℚ. Returns null if singular. */
export function finverse(X: FMat): FMat | null {
  const n = X.length;
  const A = X.map((r) => r.map((v) => ({ ...v })));
  const I: FMat = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => frac(i === j ? 1n : 0n)));
  for (let c = 0; c < n; c++) {
    let p = -1;
    for (let i = c; i < n; i++) if (!fisZero(A[i][c])) { p = i; break; }
    if (p === -1) return null;
    [A[c], A[p]] = [A[p], A[c]];
    [I[c], I[p]] = [I[p], I[c]];
    const piv = A[c][c];
    for (let j = 0; j < n; j++) { A[c][j] = fdiv(A[c][j], piv); I[c][j] = fdiv(I[c][j], piv); }
    for (let i = 0; i < n; i++) {
      if (i === c || fisZero(A[i][c])) continue;
      const f = A[i][c];
      for (let j = 0; j < n; j++) {
        A[i][j] = fsub(A[i][j], fmul(f, A[c][j]));
        I[i][j] = fsub(I[i][j], fmul(f, I[c][j]));
      }
    }
  }
  return I;
}

// ─── signature ───────────────────────────────────────────────────────────────

export interface Signature { pos: number; neg: number; zero: number }

/** A congruence diagonalization: LᵀML = diag(diagonal), with L invertible. */
export interface Congruence { L: FMat; diagonal: Frac[] }

/**
 * Diagonalize a symmetric rational matrix by congruence, returning the
 * transform: LᵀML = diag. Exact.
 *
 * The elementary steps are simultaneous row+column operations, each of which is
 * M ↦ EᵀME for an elementary E, so accumulating L = E₁E₂⋯ gives the transform.
 * Column-op `col_k −= f·col_i` is E = I − f·e_i e_kᵀ; the rescue step
 * `col_i += col_j` (used when the active block has a zero diagonal but a nonzero
 * off-diagonal entry) is E = I + e_j e_iᵀ.
 *
 * Callers wanting a Q-ORTHONORMAL frame scale the columns of L by
 * 1/√|diagonal_i|, which turns the form into diag(±1) — the standard-signature
 * coordinates. That rescaling is irrational in general, hence left to the caller
 * in floating point.
 */
export function congruenceDiagonalize(input: FMat): Congruence {
  const n = input.length;
  const M = input.map((r) => r.map((v) => ({ ...v })));
  let L: FMat = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => frac(i === j ? 1n : 0n)));

  const colOp = (target: number, source: number, f: Frac, sign: -1 | 1): void => {
    // col_target += sign·f·col_source, then the matching row op, then L.
    for (let k = 0; k < n; k++) {
      M[k][target] = sign === 1
        ? fadd(M[k][target], fmul(f, M[k][source]))
        : fsub(M[k][target], fmul(f, M[k][source]));
    }
    for (let k = 0; k < n; k++) {
      M[target][k] = sign === 1
        ? fadd(M[target][k], fmul(f, M[source][k]))
        : fsub(M[target][k], fmul(f, M[source][k]));
    }
    for (let k = 0; k < n; k++) {
      L[k][target] = sign === 1
        ? fadd(L[k][target], fmul(f, L[k][source]))
        : fsub(L[k][target], fmul(f, L[k][source]));
    }
  };

  const active = Array.from({ length: n }, (_, i) => i);
  const order: number[] = [];
  while (active.length > 0) {
    let at = active.findIndex((i) => !fisZero(M[i][i]));
    if (at === -1) {
      let found = false;
      outer:
      for (let a = 0; a < active.length; a++) {
        for (let b = a + 1; b < active.length; b++) {
          if (!fisZero(M[active[a]][active[b]])) {
            colOp(active[a], active[b], frac(1n), 1);
            at = a; found = true; break outer;
          }
        }
      }
      if (!found) { for (const i of active) order.push(i); break; }
    }
    const i = active[at];
    const p = M[i][i];
    for (const k of active) {
      if (k === i || fisZero(M[k][i])) continue;
      colOp(k, i, fdiv(M[k][i], p), -1);
    }
    order.push(i);
    active.splice(at, 1);
  }
  return { L, diagonal: Array.from({ length: n }, (_, i) => M[i][i]) };
}

/**
 * Signature of a symmetric rational matrix, exactly, by congruence
 * diagonalization (Sylvester's law of inertia).
 *
 * Each step picks a nonzero diagonal pivot and clears its row and column with
 * SIMULTANEOUS row and column operations — that is the congruence M ↦ EᵀME, the
 * transformation under which a quadratic form's signature is invariant. When
 * every remaining diagonal entry is zero but some off-diagonal M[i][j] is not,
 * adding row/column j into i makes M[i][i] = 2·M[i][j] ≠ 0, restoring a pivot.
 * Counting the signs of the resulting diagonal gives (pos, neg, zero).
 */
export function signatureOfSymmetric(input: FMat): Signature {
  const n = input.length;
  const M = input.map((r) => r.map((v) => ({ ...v })));
  const active = Array.from({ length: n }, (_, i) => i);
  let pos = 0, neg = 0, zero = 0;

  const addRowColInto = (i: number, j: number): void => {
    for (let k = 0; k < n; k++) M[i][k] = fadd(M[i][k], M[j][k]);
    for (let k = 0; k < n; k++) M[k][i] = fadd(M[k][i], M[k][j]);
  };

  while (active.length > 0) {
    let pivot = active.findIndex((i) => !fisZero(M[i][i]));
    if (pivot === -1) {
      // No diagonal pivot: look for any nonzero off-diagonal in the active block.
      let found = false;
      outer:
      for (let a = 0; a < active.length; a++) {
        for (let b = a + 1; b < active.length; b++) {
          if (!fisZero(M[active[a]][active[b]])) {
            addRowColInto(active[a], active[b]);
            pivot = a;
            found = true;
            break outer;
          }
        }
      }
      if (!found) { zero += active.length; break; }  // whole active block is zero
    }
    const i = active[pivot];
    const p = M[i][i];
    if (fsign(p) > 0) pos++; else neg++;
    for (const k of active) {
      if (k === i || fisZero(M[k][i])) continue;
      const f = fdiv(M[k][i], p);
      for (const j of active) M[k][j] = fsub(M[k][j], fmul(f, M[i][j]));
      for (const j of active) M[j][k] = fsub(M[j][k], fmul(f, M[j][i]));
    }
    active.splice(pivot, 1);
  }
  return { pos, neg, zero };
}

/** Convenience: signature of a symmetric INTEGER matrix. */
export const signatureOfSymmetricInt = (X: IMat): Signature =>
  signatureOfSymmetric(ifromInt(X));
