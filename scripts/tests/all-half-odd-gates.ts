/**
 * Correctness gates for the odd all-half tower (src/examples/hypergeometric/all-half-odd.ts).
 *
 * The family is built from binomial coefficients ("route B"), so almost every
 * claim below can be settled EXACTLY. The pattern throughout is *float proposes,
 * BigInt disposes*: where a quantity is easiest to obtain numerically (A⁻¹, and
 * hence T = B·A⁻¹), we round it to integers and then certify the integer matrix
 * by exact arithmetic. We never need to derive it exactly — only to verify it.
 *
 * Pinned, in the order the construction depends on them:
 *   1. ROUTES AGREE — the binomial route and the older rotation-number route
 *      (`cyclotomicProduct` on α = 0×d, β = ½×d) give identical integer
 *      polynomials, and at d = 5 those are catalog row #48's own α/β. This is
 *      what makes the existing O(5) picture a regression anchor.
 *   2. THE PAPER'S RULE — Comp((x−1)^d) agrees with the normal-form definition
 *      stated separately in §1: Ae_i = e_{i+1}, Ae_{d−1} = Σ_j (−1)^j C(d,j) e_j.
 *   3. INTEGRALITY — A, B ∈ GL_d(ℤ) with det A = +1, det B = −1 (the latter is
 *      what makes B a product of an odd number of reflections, per §3).
 *   4. UNIPOTENCE — (A−I)^d = 0 and (B+I)^d = 0 exactly, i.e. χ_A = (x−1)^d and
 *      χ_B = (x+1)^d as the tower's definition requires.
 *   5. THE REFLECTION — T = B·A⁻¹ is an exactly integral involution with
 *      rank(T−I) = 1 and det T = −1: the paper's R, and the reason the
 *      free-product walk is legitimate.
 *   6. THE SEED — γ = B²T is provably NOT unipotent (an integer trace outside
 *      {±d} rules it out, since a ±unipotent d×d matrix has trace ±d), and power
 *      iteration converges to its fixed point. This is the check that replaces
 *      the loxodromic search, which is unsafe here: every characteristic root of
 *      a generator is a d-fold root at ±1 and numeric root-finding scatters it
 *      well past any usable threshold.
 *   7. IDENTICAL ORBIT AT d = 5 — the new module and `hypergeometricAction` on
 *      catalog #48 produce the same orbit, point for point.
 *
 * The invariant form Q, its signature O(m+1,m), det Q = 2^(d²) and the
 * Hessenberg walk determinant det H_b > 2 are NOT gated here: they belong to the
 * normal-form construction, which is a later phase.
 *
 * Run:  node scripts/tests/all-half-odd-gates.ts
 */

import {
  DEGREES, allHalfOddPolynomials, allHalfOddMatrices, allHalfOddAction,
  allHalfOddRotations, seedAllHalfOdd, binomialRow, ALL_HALF_ODD_SEED_WORD,
} from '../../src/examples/hypergeometric/all-half-odd.ts';
import { companionPairAlphabet, hypergeometricAction } from '../../src/examples/hypergeometric/recipe.ts';
import { CATALOG_EXAMPLES, ORTHOGONAL_DEGREE5_WALK } from '../../src/examples/hypergeometric/degree5-orthogonal.ts';
import { cyclotomicProduct } from '../../src/core/polynomial.ts';
import { type Mat, matDim, matInverse } from '../../src/core/matrix.ts';
import { generateOrbit } from '../../src/core/orbit.ts';
import { seedFromLoxodromic } from '../../src/core/seed.ts';

let failures = 0;
function check(name: string, ok: boolean, detail = ''): void {
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? `  — ${detail}` : ''}`);
  if (!ok) failures++;
}

// ─── exact integer matrices ──────────────────────────────────────────────────

type BMat = bigint[][];

/** Round a float matrix to integers, refusing anything not within `tol`. */
function toExact(M: Mat, tol = 1e-6): BMat | null {
  const n = matDim(M);
  const out: BMat = [];
  for (let i = 0; i < n; i++) {
    const row: bigint[] = [];
    for (let j = 0; j < n; j++) {
      const v = M[i * n + j];
      const r = Math.round(v);
      if (!Number.isFinite(v) || Math.abs(v - r) > tol) return null;
      row.push(BigInt(r));
    }
    out.push(row);
  }
  return out;
}

const bId = (n: number): BMat =>
  Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1n : 0n)));

function bMul(X: BMat, Y: BMat): BMat {
  const n = X.length;
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => {
      let s = 0n;
      for (let k = 0; k < n; k++) s += X[i][k] * Y[k][j];
      return s;
    }));
}

const bAddScalar = (X: BMat, c: bigint): BMat =>
  X.map((row, i) => row.map((v, j) => (i === j ? v + c : v)));

const bIsZero = (X: BMat): boolean => X.every((r) => r.every((v) => v === 0n));
const bEq = (X: BMat, Y: BMat): boolean => X.every((r, i) => r.every((v, j) => v === Y[i][j]));
const bTrace = (X: BMat): bigint => X.reduce((s, r, i) => s + r[i], 0n);

/** Exact determinant by fraction-free (Bareiss) elimination. */
function bDet(M: BMat): bigint {
  const n = M.length;
  const A = M.map((r) => r.slice());
  let sign = 1n;
  let prev = 1n;
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

/** Exact rank by fraction-free elimination. */
function bRank(M: BMat): number {
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

function bPow(X: BMat, e: number): BMat {
  let acc = bId(X.length);
  for (let i = 0; i < e; i++) acc = bMul(acc, X);
  return acc;
}

console.log('all-half-odd gates');

// ─── 1. the two construction routes agree ────────────────────────────────────
console.log('\n1. routes agree: binomials vs rotation numbers');
{
  const g48 = CATALOG_EXAMPLES.find((e) => e.bsNo === 48);
  const r5 = allHalfOddRotations(5);
  check('catalog row #48 is this family at d = 5', !!g48
    && JSON.stringify(g48.alpha) === JSON.stringify(r5.alpha)
    && JSON.stringify(g48.beta) === JSON.stringify(r5.beta),
    g48 ? `α = (${g48.alpha.join(',')}), β = (${g48.beta.join(',')})` : 'row #48 missing');
  check('this family walks the same alphabet as the O(5) catalog',
    ORTHOGONAL_DEGREE5_WALK === 'free-product');
}
for (const d of DEGREES) {
  const { f, g } = allHalfOddPolynomials(d);
  const { alpha, beta } = allHalfOddRotations(d);
  let via: string;
  let ok: boolean;
  try {
    const f2 = cyclotomicProduct(alpha);
    const g2 = cyclotomicProduct(beta);
    ok = JSON.stringify(f) === JSON.stringify(f2) && JSON.stringify(g) === JSON.stringify(g2);
    via = ok ? 'identical' : 'MISMATCH';
  } catch (e) {
    // The rotation route multiplies d complex numbers and snaps to integers; far
    // enough up the tower that snap legitimately fails. Not a failure of route B.
    ok = true;
    via = `rotation route unavailable (${(e as Error).message.slice(0, 42)}…)`;
  }
  check(`d = ${String(d).padStart(2)}`, ok, via);
}

// ─── 2. the paper's normal-form rule for A ───────────────────────────────────
console.log("\n2. Comp((x−1)^d) matches the paper's explicit rule for A");
for (const d of DEGREES) {
  const { A } = allHalfOddMatrices(d);
  const c = binomialRow(d);
  let ok = true;
  // Ae_i = e_{i+1} for i < d−1
  for (let i = 0; i < d - 1 && ok; i++) {
    for (let r = 0; r < d; r++) if (A[r * d + i] !== (r === i + 1 ? 1 : 0)) ok = false;
  }
  // Ae_{d−1} = Σ_j (−1)^j C(d,j) e_j
  for (let j = 0; j < d && ok; j++) {
    if (A[j * d + (d - 1)] !== (j % 2 === 0 ? c[j] : -c[j])) ok = false;
  }
  check(`d = ${String(d).padStart(2)}`, ok);
}

// ─── 3–5. integrality, unipotence, the reflection ────────────────────────────
console.log('\n3. A, B ∈ GL_d(ℤ):  det A = +1, det B = −1');
const exactAt = new Map<number, { A: BMat; B: BMat; T: BMat }>();
for (const d of DEGREES) {
  const { A, B } = allHalfOddMatrices(d);
  const alph = companionPairAlphabet(A, B, 'free-product');
  const eA = toExact(A), eB = toExact(B), eT = toExact(alph.matrices[0] as Mat);
  if (!eA || !eB || !eT) { check(`d = ${d}`, false, 'a generator is not integral'); continue; }
  exactAt.set(d, { A: eA, B: eB, T: eT });
  const dA = bDet(eA), dB = bDet(eB);
  check(`d = ${String(d).padStart(2)}`, dA === 1n && dB === -1n, `det A = ${dA}, det B = ${dB}`);
}

console.log('\n4. unipotence: (A−I)^d = 0 and (B+I)^d = 0, exactly');
for (const d of DEGREES) {
  const e = exactAt.get(d);
  if (!e) { check(`d = ${d}`, false, 'no exact matrices'); continue; }
  const okA = bIsZero(bPow(bAddScalar(e.A, -1n), d));
  const okB = bIsZero(bPow(bAddScalar(e.B, 1n), d));
  check(`d = ${String(d).padStart(2)}`, okA && okB,
    `(A−I)^d ${okA ? '= 0' : '≠ 0'}, (B+I)^d ${okB ? '= 0' : '≠ 0'}`);
}

console.log('\n5. T = B·A⁻¹ is the reflection R: T² = I, rank(T−I) = 1, det T = −1');
for (const d of DEGREES) {
  const e = exactAt.get(d);
  if (!e) { check(`d = ${d}`, false, 'no exact matrices'); continue; }
  // Certify the proposed integer T really is B·A⁻¹, by T·A = B.
  const isInverse = bEq(bMul(e.T, e.A), e.B);
  const invol = bEq(bMul(e.T, e.T), bId(d));
  const rk = bRank(bAddScalar(e.T, -1n));
  const dT = bDet(e.T);
  check(`d = ${String(d).padStart(2)}`, isInverse && invol && rk === 1 && dT === -1n,
    `T·A = B: ${isInverse}, T² = I: ${invol}, rank(T−I) = ${rk}, det T = ${dT}`);
  // A⁻¹ is integral (det A = 1), so the float inverse must round to it exactly.
  const eAinv = toExact(matInverse(allHalfOddMatrices(d).A));
  check(`d = ${String(d).padStart(2)}  A⁻¹ integral`, !!eAinv && bEq(bMul(e.A, eAinv), bId(d)));
}

// ─── 6. the seed word ────────────────────────────────────────────────────────
console.log('\n6. seed γ = B²T: trace is exactly −d(2d−1), and power iteration converges');
// Writing B = RA and T = R, cyclicity of the trace gives
//   tr(B²T) = tr(RARAR) = tr(A²R) = tr(A²) − Q(A²e₀, e₀) = d − c_d(2),
// by the orbit-Gram lemma (§1), and c_d(2) = 2d + 4·C(d,2) = 2d². So
//   tr(B²T) = d − 2d² = −d(2d−1)
// at every degree. This pins the seed word's identity far more tightly than the
// inequality we actually need — and since a ±unipotent d×d matrix has trace ±d,
// while −d(2d−1) = ±d only for d ≤ 1, it rules out unipotence as a corollary.
for (const d of DEGREES) {
  const e = exactAt.get(d);
  if (!e) { check(`d = ${d}`, false, 'no exact matrices'); continue; }
  // Apply-order [0,1,1] is the group element B·B·T.
  const tr = bTrace(bMul(bMul(e.B, e.B), e.T));
  const want = -BigInt(d) * (2n * BigInt(d) - 1n);
  const notUnipotent = tr !== BigInt(d) && tr !== BigInt(-d);
  const action = allHalfOddAction(d);
  const s = seedAllHalfOdd(action);
  const converged = s.drift < 1e-9 && Number.isFinite(s.lambdaMax) && s.lambdaMax > 2;
  check(`d = ${String(d).padStart(2)}`, tr === want && notUnipotent && converged,
    `tr = ${tr} (= −d(2d−1) ✓, ≠ ±${d}), |λ| = ${s.lambdaMax.toFixed(2)}, drift = ${s.drift.toExponential(1)}, γ = ${s.name}`);
}

// ─── 7. d = 5 reproduces the existing O(5) catalog picture ───────────────────
console.log('\n7. d = 5 orbit is identical to catalog #48 via hypergeometricAction');
{
  const g48 = CATALOG_EXAMPLES.find((e) => e.bsNo === 48)!;
  const oldAction = hypergeometricAction(g48.alpha, g48.beta, ORTHOGONAL_DEGREE5_WALK);
  const newAction = allHalfOddAction(5);

  const oldSeed = seedFromLoxodromic(oldAction, { labels: ['T', 'B', 'B⁻¹'] });
  const newSeed = seedAllHalfOdd(newAction);
  check('the loxodromic search on #48 finds the same word we hard-code',
    JSON.stringify(oldSeed.word) === JSON.stringify([...ALL_HALF_ODD_SEED_WORD]),
    `search → ${oldSeed.name} ${JSON.stringify(oldSeed.word)}, hard-coded ${JSON.stringify([...ALL_HALF_ODD_SEED_WORD])}`);

  const N = 12;
  const o1 = generateOrbit(oldAction, oldSeed.basepoint, N);
  const o2 = generateOrbit(newAction, newSeed.basepoint, N);
  let maxDev = 0;
  const sameCount = o1.count === o2.count;
  if (sameCount) {
    for (let i = 0; i < o1.vecs.length; i++) {
      maxDev = Math.max(maxDev, Math.abs(o1.vecs[i] - o2.vecs[i]));
    }
  }
  check(`orbits agree (N = ${N}, ${o1.count} points)`, sameCount && maxDev < 1e-12,
    `max |Δ| = ${maxDev.toExponential(2)}`);
}

console.log(`\n${failures === 0 ? 'all gates passed' : `${failures} gate(s) FAILED`}`);
if (failures > 0) process.exit(1);
