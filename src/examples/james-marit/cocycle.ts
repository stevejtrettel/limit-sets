/**
 * Peripheral cocycle condition for the punctured-torus block construction.
 *
 * The 4×4 generator for g is  M(g) = [ A_g  0 ; v_g  1 ]  with A_g 3×3 and v_g a
 * row vector in ℝ³. Multiplying out the commutator [a,b] = a b a⁻¹ b⁻¹ gives
 *     v_{[a,b]} = v_a · M_a + v_b · M_b,
 *     M_a = (A_b − I)·A_a⁻¹·A_b⁻¹,   M_b = (A_a⁻¹ − I)·A_b⁻¹.
 * The condition v_{[a,b]} = 0 is 3 linear equations in (v_a, v_b) ∈ ℝ⁶, so the
 * solution set is the left null space of the stacked 6×3 matrix — equivalently
 * the kernel of the 3×6 matrix Nᵀ. `cocycleSpace` returns an orthonormal basis.
 *
 * The 3×3 block algebra comes from core/matrix; the (non-square) nullspace +
 * Gram–Schmidt are specific to this 3×6 constraint, so they live here.
 */

import { type Mat, identity, matMul, matInverse, matSub } from '../../core/matrix.ts';

export type Vec6 = readonly [number, number, number, number, number, number];

export interface CocycleSpace {
  /** Orthonormal basis of the solution space ⊂ ℝ⁶ (length = nullity). */
  basis: readonly Vec6[];
  /** Rank of the 3×6 constraint matrix. Generically 3 → nullity 3. */
  rank: number;
}

/** M_a, M_b (flat 3×3) from the scaled blocks A, B. */
function blockOperators(A: Mat, B: Mat): { Ma: Mat; Mb: Mat } {
  const Ainv = matInverse(A);
  const Binv = matInverse(B);
  const I = identity(3);
  const Ma = matMul(matMul(matSub(B, I), Ainv), Binv);
  const Mb = matMul(matSub(Ainv, I), Binv);
  return { Ma, Mb };
}

/** 3×6 constraint matrix C with w·N = 0 ⇔ Nᵀwᵀ = 0 for w = [v_a, v_b]. */
function constraintMatrix(A: Mat, B: Mat): number[][] {
  const { Ma, Mb } = blockOperators(A, B);
  const C: number[][] = [[0,0,0,0,0,0],[0,0,0,0,0,0],[0,0,0,0,0,0]];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      C[i][j]     = Ma[j * 3 + i]; // M_aᵀ
      C[i][j + 3] = Mb[j * 3 + i]; // M_bᵀ
    }
  }
  return C;
}

/** Null space of an m×n matrix via Gaussian elimination (one basis vector per
 *  free column). Not orthogonal; run gramSchmidt for that. */
function nullSpaceRREF(M: number[][], m: number, n: number, eps = 1e-10): { basis: number[][]; rank: number } {
  const A = M.map((row) => row.slice());
  const pivotCol: number[] = [];
  let r = 0;
  for (let c = 0; c < n && r < m; c++) {
    let best = r, bestVal = Math.abs(A[r][c]);
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

export function cocycleSpace(A: Mat, B: Mat): CocycleSpace {
  const C = constraintMatrix(A, B);
  const { basis: raw, rank } = nullSpaceRREF(C, 3, 6);
  const ortho = gramSchmidt(raw);
  return { basis: ortho.map((v) => v as unknown as Vec6), rank };
}

/** Diagnostic: ‖v_a·M_a + v_b·M_b‖ for a given sextuple (how close to the kernel). */
export function commutatorBottomRowNorm(A: Mat, B: Mat, v: Vec6): number {
  const { Ma, Mb } = blockOperators(A, B);
  let s = 0;
  for (let j = 0; j < 3; j++) {
    let r = 0;
    for (let k = 0; k < 3; k++) r += v[k] * Ma[k * 3 + j] + v[k + 3] * Mb[k * 3 + j];
    s += r * r;
  }
  return Math.sqrt(s);
}

/** Combine basis vectors with coefficients α into a single Vec6. */
export function combineBasis(basis: readonly Vec6[], alphas: readonly number[]): Vec6 {
  const out: [number, number, number, number, number, number] = [0, 0, 0, 0, 0, 0];
  const k = Math.min(basis.length, alphas.length);
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < 6; j++) out[j] += alphas[i] * basis[i][j];
  }
  return out;
}
