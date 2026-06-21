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

import { CATALOG_EXAMPLES } from '../src/o5/catalog.ts';
import { buildO5Matrices, makeO5Action, mul5, type Mat5 } from '../src/o5/action.ts';
import { findLoxodromicWord } from '../src/o5/seed.ts';
import { jacobiSymmetricEig } from '../src/core/linalg.ts';

const N = 5;

function transpose(M: Mat5): Mat5 {
  const T = new Float64Array(25);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) T[j * N + i] = M[i * N + j];
  return T;
}
function det5(M: Mat5): number {
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
function maxIntErr(M: Mat5): number {
  let e = 0;
  for (let i = 0; i < 25; i++) e = Math.max(e, Math.abs(M[i] - Math.round(M[i])));
  return e;
}
function isIdentity(M: Mat5, eps = 1e-9): boolean {
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

function basisE(p: number): Mat5 {
  const [i, j] = PARAMS[p];
  const E = new Float64Array(25);
  E[i * N + j] = 1; E[j * N + i] = 1;
  return E;
}
function upperTri(M: Mat5): number[] {
  return PARAMS.map(([i, j]) => M[i * N + j]);
}

/** Solve for the (1-dim) space of forms with GᵀQG = Q for every G. */
function invariantForm(gens: Mat5[]): { Q: number[][]; residual: number; eigGap: number } {
  // Build constraint matrix M (rows = gens × upper-tri entries, cols = params).
  const rows: number[][] = [];
  for (const G of gens) {
    const Gt = transpose(G);
    const cols: number[][] = PARAMS.map((_, p) => {
      const E = basisE(p);
      const D = mul5(Gt, mul5(E, G)); // GᵀEG
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

// ─── Eigenvalues of a general 5×5 (Faddeev–LeVerrier + Durand–Kerner) ─────────

type Cx = { re: number; im: number };
const cAdd = (a: Cx, b: Cx): Cx => ({ re: a.re + b.re, im: a.im + b.im });
const cSub = (a: Cx, b: Cx): Cx => ({ re: a.re - b.re, im: a.im - b.im });
const cMul = (a: Cx, b: Cx): Cx => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
const cDiv = (a: Cx, b: Cx): Cx => {
  const d = b.re * b.re + b.im * b.im;
  return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d };
};
const cAbs = (a: Cx): number => Math.hypot(a.re, a.im);

/** Monic characteristic polynomial coeffs [1, c1, …, c5] (high-degree first). */
function charPoly(M: Mat5): number[] {
  let Mk = new Float64Array(25); for (let i = 0; i < N; i++) Mk[i * N + i] = 1; // I
  const c = [1];
  for (let k = 1; k <= N; k++) {
    Mk = mul5(M, Mk);
    let tr = 0; for (let i = 0; i < N; i++) tr += Mk[i * N + i];
    const ck = -tr / k;
    c.push(ck);
    for (let i = 0; i < N; i++) Mk[i * N + i] += ck; // Mk = M·(Mk) + ck·I  (next iter multiplies by M)
  }
  return c;
}

function roots(coef: number[]): Cx[] {
  const n = coef.length - 1;
  const evalP = (z: Cx): Cx => {
    let r: Cx = { re: coef[0], im: 0 };
    for (let i = 1; i <= n; i++) r = cAdd(cMul(r, z), { re: coef[i], im: 0 });
    return r;
  };
  let z: Cx[] = [];
  for (let i = 0; i < n; i++) {
    const ang = (2 * Math.PI * i) / n + 0.4;
    z.push({ re: 0.7 * Math.cos(ang), im: 0.7 * Math.sin(ang) });
  }
  for (let it = 0; it < 500; it++) {
    let maxStep = 0;
    for (let i = 0; i < n; i++) {
      let denom: Cx = { re: 1, im: 0 };
      for (let j = 0; j < n; j++) if (j !== i) denom = cMul(denom, cSub(z[i], z[j]));
      const step = cDiv(evalP(z[i]), denom);
      z[i] = cSub(z[i], step);
      maxStep = Math.max(maxStep, cAbs(step));
    }
    if (maxStep < 1e-13) break;
  }
  return z.sort((a, b) => cAbs(b) - cAbs(a));
}

function fmtRoots(rs: Cx[]): string {
  return rs.map((r) => Math.abs(r.im) < 1e-7
    ? `${r.re.toFixed(4)}`
    : `${r.re.toFixed(4)}${r.im >= 0 ? '+' : '−'}${Math.abs(r.im).toFixed(4)}i`).join(',  ');
}

// ─── Run ─────────────────────────────────────────────────────────────────────

const ARGS = process.argv.slice(2);
// Default: the α=(0,1/10,…) family, where TB is elliptic (10th roots of unity).
const ELLIPTIC_TB = ['o32-open-7', 'o41-open-1'];
const targets = ARGS.length > 0
  ? CATALOG_EXAMPLES.filter((e) => ARGS.includes(e.id))
  : CATALOG_EXAMPLES.filter((e) => ELLIPTIC_TB.includes(e.id));

for (const ex of targets) {
  const { A, B, T } = buildO5Matrices(ex.coefflistf, ex.coefflistg);
  console.log(`\n=== ${ex.id}  (${ex.label}, ${ex.type}) ===`);
  console.log(`  integer-entry err: A ${maxIntErr(A).toExponential(1)}, B ${maxIntErr(B).toExponential(1)}`);
  console.log(`  det A = ${det5(A).toFixed(4)}, det B = ${det5(B).toFixed(4)}, T²=I: ${isIdentity(mul5(T, T))}`);

  // Definitive companion check: charpoly(A) = f, charpoly(B) = g (the whole
  // point of a companion matrix). Robust regardless of conditioning.
  const cpA = charPoly(A).map(Math.round), cpB = charPoly(B).map(Math.round);
  const eq = (x: number[], y: readonly number[]): boolean => x.length === y.length && x.every((v, i) => v === y[i]);
  console.log(`  charpoly(A) = f: ${eq(cpA, ex.coefflistf)}   charpoly(B) = g: ${eq(cpB, ex.coefflistg)}`);

  const { Q, residual, eigGap } = invariantForm([A, B]);
  const sig = signature(Q);
  console.log(`  invariant form Q: residual ${residual.toExponential(1)}, null-space gap ${eigGap.toExponential(1)} (≫1 ⇒ unique)`);
  console.log(`  signature(Q) = (${sig.pos}, ${sig.neg})  [claimed ${ex.type}]`);

  const TB = mul5(T, B);
  console.log(`  eig(TB):  ${fmtRoots(roots(charPoly(TB)))}`);

  // The loxodromic seed word the pipeline actually uses; build its matrix.
  const lox = findLoxodromicWord(makeO5Action(ex.coefflistf, ex.coefflistg));
  if (lox) {
    let W = new Float64Array(25); for (let i = 0; i < N; i++) W[i * N + i] = 1;
    const mats = [T, B, buildO5Matrices(ex.coefflistf, ex.coefflistg).Binv];
    for (const g of lox.word) W = mul5(mats[g], W); // apply-order ⇒ left-multiply
    console.log(`  eig(γ=${lox.name}):  ${fmtRoots(roots(charPoly(W)))}`);
  }
}
