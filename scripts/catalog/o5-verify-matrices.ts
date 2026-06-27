/**
 * Audit the O(5) generator matrices for given catalog ids (default: the two
 * cases where γ = TB has a complex dominant eigenvalue).
 *
 *   node scripts/o5-verify-matrices.ts [id ...]
 *
 * For each group it checks:
 *   1. integer entries, det A/B = ±1, T² = I;
 *   2. the invariant quadratic form Q (solve AᵀQA = Q, BᵀQB = Q) exists, is
 *      1-dimensional, and has the SIGNATURE claimed in the catalog — the
 *      definitive proof the companion matrices are the right orthogonal group;
 *   3. the eigenvalues of TB (and of the catalog's seed word), to show whether
 *      the dominant eigenvalue is real or a complex pair.
 */

import { CATALOG_EXAMPLES } from '../../src/examples/hypergeometric/degree5-orthogonal.ts';
import { companion, matInverse, matMul, type Mat } from '../../src/core/matrix.ts';
import { cyclotomicProduct } from '../../src/core/polynomial.ts';
import { hypergeometricAction } from '../../src/examples/hypergeometric/recipe.ts';
import { findLoxodromicWord, formatWord } from '../../src/core/seed.ts';
import { jacobiSymmetricEig, charPoly, polyRoots, type Complex } from '../../src/core/linalg.ts';

const N = 5;

function transpose(M: Mat): Mat {
  const T = new Float64Array(25);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) T[j * N + i] = M[i * N + j];
  return T;
}
function det5(M: Mat): number {
  const sub = (rows: number[], cols: number[]): number => {
    if (rows.length === 1) return M[rows[0] * N + cols[0]];
    let s = 0;
    for (let j = 0; j < cols.length; j++) {
      const mc = cols.filter((_, t) => t !== j);
      s += (j % 2 ? -1 : 1) * M[rows[0] * N + cols[j]] * sub(rows.slice(1), mc);
    }
    return s;
  };
  return sub([0, 1, 2, 3, 4], [0, 1, 2, 3, 4]);
}
function maxIntErr(M: Mat): number {
  let e = 0;
  for (let i = 0; i < 25; i++) e = Math.max(e, Math.abs(M[i] - Math.round(M[i])));
  return e;
}
function isIdentity(M: Mat, eps = 1e-9): boolean {
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++)
    if (Math.abs(M[i * N + j] - (i === j ? 1 : 0)) > eps) return false;
  return true;
}

// ─── Invariant quadratic form ────────────────────────────────────────────────
// Params index the upper triangle (i≤j) of a symmetric Q. Column p of the
// constraint matrix is the upper-triangle of (GᵀE_pG − E_p) for each generator.

const PARAMS: [number, number][] = [];
for (let i = 0; i < N; i++) for (let j = i; j < N; j++) PARAMS.push([i, j]);
const P = PARAMS.length; // 15

function basisE(p: number): Mat {
  const [i, j] = PARAMS[p];
  const E = new Float64Array(25);
  E[i * N + j] = 1; E[j * N + i] = 1;
  return E;
}
function upperTri(M: Mat): number[] {
  return PARAMS.map(([i, j]) => M[i * N + j]);
}

/** Solve for the (1-dim) space of forms with GᵀQG = Q for every G. */
function invariantForm(gens: Mat[]): { Q: number[][]; residual: number; eigGap: number } {
  // Build constraint matrix M (rows = gens × upper-tri entries, cols = params).
  const rows: number[][] = [];
  for (const G of gens) {
    const Gt = transpose(G);
    const cols: number[][] = PARAMS.map((_, p) => {
      const E = basisE(p);
      const D = matMul(Gt, matMul(E, G)); // GᵀEG
      for (let k = 0; k < 25; k++) D[k] -= E[k];
      return upperTri(D);
    });
    // cols[p] is the p-th column; transpose into equation rows.
    const nEq = P;
    for (let r = 0; r < nEq; r++) rows.push(cols.map((c) => c[r]));
  }
  // Normalize each equation row (the companion entries are wildly scaled, which
  // otherwise makes the normal matrix ill-conditioned and the null vector noisy).
  for (const row of rows) {
    let nrm = 0; for (const x of row) nrm += x * x;
    nrm = Math.sqrt(nrm);
    if (nrm > 1e-12) for (let a = 0; a < P; a++) row[a] /= nrm;
  }
  // Normal matrix Nmat = MᵀM (P×P), smallest eigenvector = solution.
  const Nmat: number[][] = Array.from({ length: P }, () => Array(P).fill(0));
  for (const row of rows) for (let a = 0; a < P; a++) for (let b = 0; b < P; b++) Nmat[a][b] += row[a] * row[b];
  const { vals, vecs } = jacobiSymmetricEig(Nmat, P);
  const order = vals.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v).map((x) => x.i);
  const q = vecs[order[0]];
  const eigGap = vals[order[1]] / (vals[order[0]] + 1e-30); // big ⇒ null space is 1-dim
  // Reconstruct Q.
  const Q: number[][] = Array.from({ length: N }, () => Array(N).fill(0));
  PARAMS.forEach(([i, j], p) => { Q[i][j] = q[p]; Q[j][i] = q[p]; });
  // Residual ||M q|| / ||q||.
  let res = 0;
  for (const row of rows) { let s = 0; for (let a = 0; a < P; a++) s += row[a] * q[a]; res += s * s; }
  return { Q, residual: Math.sqrt(res), eigGap };
}

function signature(Q: number[][]): { pos: number; neg: number; zero: number } {
  const { vals } = jacobiSymmetricEig(Q, N);
  const scale = Math.max(...vals.map((v) => Math.abs(v)));
  let pos = 0, neg = 0, zero = 0;
  for (const v of vals) {
    if (v > 1e-6 * scale) pos++;
    else if (v < -1e-6 * scale) neg++;
    else zero++;
  }
  return { pos, neg, zero };
}

// ─── Eigenvalues of a 5×5 (char poly + complex roots, from @/core/linalg) ─────

/** Mat (row-major Float64) → number[][] for the linalg spectrum routines. */
const rows5 = (M: Mat): number[][] =>
  Array.from({ length: N }, (_, i) => Array.from({ length: N }, (_, j) => M[i * N + j]));
/** Full complex spectrum of a 5×5, descending modulus. */
const eigenvalues = (M: Mat): Complex[] => polyRoots(charPoly(rows5(M)));

function fmtRoots(rs: Complex[]): string {
  return rs.map((r) => Math.abs(r.im) < 1e-7
    ? `${r.re.toFixed(4)}`
    : `${r.re.toFixed(4)}${r.im >= 0 ? '+' : '−'}${Math.abs(r.im).toFixed(4)}i`).join(',  ');
}

// ─── Run ─────────────────────────────────────────────────────────────────────

const ARGS = process.argv.slice(2);
// Default: the α=(0,1/10,…) family, where TB is elliptic (10th roots of unity).
const ELLIPTIC_TB = ['g66', 'g77'];
const targets = ARGS.length > 0
  ? CATALOG_EXAMPLES.filter((e) => ARGS.includes(e.id))
  : CATALOG_EXAMPLES.filter((e) => ELLIPTIC_TB.includes(e.id));

for (const ex of targets) {
  const f = cyclotomicProduct(ex.alpha), g = cyclotomicProduct(ex.beta);
  const A = companion(f), B = companion(g), T = matMul(B, matInverse(A));
  console.log(`\n=== ${ex.id}  (${ex.label}, ${ex.type}) ===`);
  console.log(`  integer-entry err: A ${maxIntErr(A).toExponential(1)}, B ${maxIntErr(B).toExponential(1)}`);
  console.log(`  det A = ${det5(A).toFixed(4)}, det B = ${det5(B).toFixed(4)}, T²=I: ${isIdentity(matMul(T, T))}`);

  // Definitive companion check: charpoly(A) = f, charpoly(B) = g (the whole
  // point of a companion matrix). Robust regardless of conditioning.
  const cpA = charPoly(rows5(A)).map(Math.round), cpB = charPoly(rows5(B)).map(Math.round);
  const eq = (x: number[], y: readonly number[]): boolean => x.length === y.length && x.every((v, i) => v === y[i]);
  console.log(`  charpoly(A) = f: ${eq(cpA, f)}   charpoly(B) = g: ${eq(cpB, g)}`);

  const { Q, residual, eigGap } = invariantForm([A, B]);
  const sig = signature(Q);
  console.log(`  invariant form Q: residual ${residual.toExponential(1)}, null-space gap ${eigGap.toExponential(1)} (≫1 ⇒ unique)`);
  console.log(`  signature(Q) = (${sig.pos}, ${sig.neg})  [claimed ${ex.type}]`);

  const TB = matMul(T, B);
  console.log(`  eig(TB):  ${fmtRoots(eigenvalues(TB))}`);

  // The loxodromic seed word the pipeline actually uses; build its matrix.
  const lox = findLoxodromicWord(hypergeometricAction(ex.alpha, ex.beta, 'free-product'));
  if (lox) {
    let W: Mat = new Float64Array(25); for (let i = 0; i < N; i++) W[i * N + i] = 1;
    const mats = [T, B, matInverse(B)];
    for (const code of lox.word) W = matMul(mats[code], W); // apply-order ⇒ left-multiply
    console.log(`  eig(γ=${formatWord(lox.word, ['T', 'B', 'B⁻¹'])}):  ${fmtRoots(eigenvalues(W))}`);
  }
}
