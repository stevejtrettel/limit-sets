/**
 * Peripheral cocycle condition for the punctured-torus block construction.
 *
 * The 4×4 generator for g has block shape
 *     M(g) = [ A_g  0 ]
 *            [ v_g  1 ]
 * with A_g 3×3 and v_g ∈ R³ a row vector. Multiplying out the commutator
 *     [a, b] = a b a⁻¹ b⁻¹
 * (with A multiplicative, M⁻¹ giving v(g⁻¹) = −v_g · A_g⁻¹) yields
 *     v_{[a,b]} = v_a · M_a + v_b · M_b
 * where
 *     M_a = (A_b − I) · A_a⁻¹ · A_b⁻¹
 *     M_b = (A_a⁻¹ − I) · A_b⁻¹
 *
 * The condition v_{[a,b]} = 0 is 3 linear equations in the 6 unknowns
 * (v_a, v_b) ∈ R⁶. Stacking [M_a; M_b] into a 6×3 matrix N, the solution
 * set is the left null space of N — equivalently, the kernel of Nᵀ (a
 * 3×6 matrix).
 *
 * `cocycleSpace` returns an orthonormal basis (Gauss elimination on Nᵀ
 * to find a RREF basis, then Gram–Schmidt). Generic rank is 3, giving a
 * 3-dim solution space; rank is reported so the demo can warn on
 * degeneracy and offer fewer α-sliders.
 */

import type { Mat3R } from './symSquare';
import { I3, sub3, mul3, inv3 } from './symSquare';

export type Vec6 = readonly [number, number, number, number, number, number];

export interface CocycleSpace {
  /** Orthonormal basis of the solution space ⊂ R⁶ (length = nullity). */
  basis: readonly Vec6[];
  /** Rank of the 3×6 constraint matrix Nᵀ. Generically 3 → nullity 3. */
  rank: number;
}

/**
 * Construct the 3×6 constraint matrix `[M_aᵀ | M_bᵀ]` such that
 *     w · N = 0   ⇔   Nᵀ wᵀ = 0
 * for w = [v_a, v_b] ∈ R⁶.
 *
 * Returned as a 3×6 array `C[row][col]` with col 0..2 = M_aᵀ and
 * col 3..5 = M_bᵀ.
 */
function constraintMatrix(A: Mat3R, B: Mat3R): number[][] {
  const Ainv = inv3(A);
  const Binv = inv3(B);
  const Ma = mul3(mul3(sub3(B, I3), Ainv), Binv);
  const Mb = mul3(sub3(Ainv, I3), Binv);
  // M_aᵀ is the transpose; same for M_b.
  const C: number[][] = [[0,0,0,0,0,0],[0,0,0,0,0,0],[0,0,0,0,0,0]];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      C[i][j]     = Ma[j][i];
      C[i][j + 3] = Mb[j][i];
    }
  }
  return C;
}

/**
 * Null space of an m × n matrix via Gaussian elimination with partial
 * pivoting. Returns one basis vector per free column. Not orthogonal —
 * callers wanting orthonormality should run `gramSchmidt`.
 */
function nullSpaceRREF(M: number[][], m: number, n: number, eps = 1e-10): {
  basis: number[][];
  rank: number;
} {
  const A = M.map((row) => row.slice());
  const pivotCol: number[] = [];
  let r = 0;

  for (let c = 0; c < n && r < m; c++) {
    let best = r;
    let bestVal = Math.abs(A[r][c]);
    for (let i = r + 1; i < m; i++) {
      const v = Math.abs(A[i][c]);
      if (v > bestVal) { bestVal = v; best = i; }
    }
    if (bestVal < eps) continue;
    if (best !== r) [A[r], A[best]] = [A[best], A[r]];
    const inv = 1 / A[r][c];
    for (let j = c; j < n; j++) A[r][j] *= inv;
    for (let i = 0; i < m; i++) {
      if (i === r) continue;
      const f = A[i][c];
      if (Math.abs(f) < 1e-14) continue;
      for (let j = c; j < n; j++) A[i][j] -= f * A[r][j];
    }
    pivotCol.push(c);
    r++;
  }

  const rank = r;
  const isPivot = new Array<boolean>(n).fill(false);
  for (const c of pivotCol) isPivot[c] = true;

  const basis: number[][] = [];
  for (let fc = 0; fc < n; fc++) {
    if (isPivot[fc]) continue;
    const v = new Array<number>(n).fill(0);
    v[fc] = 1;
    for (let i = 0; i < rank; i++) v[pivotCol[i]] = -A[i][fc];
    basis.push(v);
  }
  return { basis, rank };
}

function gramSchmidt(vecs: number[][]): number[][] {
  const out: number[][] = [];
  for (const v of vecs) {
    const u = v.slice();
    for (const e of out) {
      let dot = 0;
      for (let i = 0; i < u.length; i++) dot += u[i] * e[i];
      for (let i = 0; i < u.length; i++) u[i] -= dot * e[i];
    }
    let norm = 0;
    for (const x of u) norm += x * x;
    norm = Math.sqrt(norm);
    if (norm < 1e-12) continue;
    for (let i = 0; i < u.length; i++) u[i] /= norm;
    out.push(u);
  }
  return out;
}

export function cocycleSpace(A: Mat3R, B: Mat3R): CocycleSpace {
  const C = constraintMatrix(A, B);
  const { basis: raw, rank } = nullSpaceRREF(C, 3, 6);
  const ortho = gramSchmidt(raw);
  return {
    basis: ortho.map((v) => v as unknown as Vec6),
    rank,
  };
}

/**
 * Diagnostic: evaluate ‖v_a · M_a + v_b · M_b‖ for a given sextuple,
 * so the demo can show how close to "in the kernel" we actually are.
 */
export function commutatorBottomRowNorm(A: Mat3R, B: Mat3R, v: Vec6): number {
  const Ainv = inv3(A);
  const Binv = inv3(B);
  const Ma = mul3(mul3(sub3(B, I3), Ainv), Binv);
  const Mb = mul3(sub3(Ainv, I3), Binv);
  const va: [number, number, number] = [v[0], v[1], v[2]];
  const vb: [number, number, number] = [v[3], v[4], v[5]];
  let s = 0;
  for (let j = 0; j < 3; j++) {
    let r = 0;
    for (let k = 0; k < 3; k++) r += va[k] * Ma[k][j] + vb[k] * Mb[k][j];
    s += r * r;
  }
  return Math.sqrt(s);
}

/** Combine basis vectors `b[i]` with coefficients `α[i]` into a single Vec6. */
export function combineBasis(basis: readonly Vec6[], alphas: readonly number[]): Vec6 {
  const out: [number, number, number, number, number, number] = [0, 0, 0, 0, 0, 0];
  const k = Math.min(basis.length, alphas.length);
  for (let i = 0; i < k; i++) {
    const v = basis[i];
    const a = alphas[i];
    for (let j = 0; j < 6; j++) out[j] += a * v[j];
  }
  return out;
}
