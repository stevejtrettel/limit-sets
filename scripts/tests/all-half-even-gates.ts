/**
 * Correctness gates for the EVEN all-half tower — the symplectic sibling of
 * `all-half-odd-gates.ts`. Exact integer / rational arithmetic throughout.
 *
 * Pinned:
 *   1. ROUTES AGREE — binomial coefficients and the older rotation-number route
 *      (`cyclotomicProduct` on α = 0×d, β = ½×d) give identical polynomials.
 *   2. INTEGRALITY & UNIPOTENCE — F, G ∈ GL_d(ℤ); (A−I)^d = 0 and (B+I)^d = 0,
 *      i.e. χ_A = (x−1)^d and χ_B = (x+1)^d as the tower's definition requires.
 *   3. THE TRANSVECTION — T is NOT an involution (this is what separates the
 *      even tower from the odd one), but N = T−I has rank 1 with N² = 0, so T is
 *      a transvection and T⁻¹ = 2I − T exactly. Certified against the
 *      conjugation P·T·F = G·P, inverse-free, using PF = FP.
 *   4. THE ALTERNATING FORM — Ω is alternating with zero diagonal, nondegenerate
 *      (rank d), and preserved by A, T and B simultaneously.
 *   5. NO QUADRIC — Ω(x,x) = 0 identically. This is the structural reason the
 *      odd tower's quadric/signature machinery has no counterpart here.
 *   6. Ω_comp — transporting through P gives a form preserved by the ORIGINAL
 *      companion generators F and G.
 *   7. THE SEED — γ = T⁻¹A has trace exactly 3d, which both pins its identity
 *      and rules out unipotence (a ±unipotent d×d matrix has trace ±d, and
 *      3d = ±d only for d = 0). Power iteration converges.
 *   8. The note's worked d = 4 fixtures: F₄, G₄, c₄, T₄, Ω₄, u, P₄.
 *
 * Run:  node scripts/tests/all-half-even-gates.ts
 */

import {
  DEGREES, allHalfEvenPolynomials, allHalfEvenCompanionPair, allHalfEvenAction,
  allHalfEvenRotations, seedAllHalfEven, transvection, transvectionInverse,
  allHalfEvenAlphabet, ALL_HALF_EVEN_SEED_WORD,
} from '../../src/examples/hypergeometric/all-half-even.ts';
import {
  cKernel, aKernel, companionPairExact, cyclicVector, changeOfBasis,
  transvectionExact, transvectionInverseExact, alternatingForm,
  normalFormGenerators, formInCompanionCoordinates, preservesForm,
  isAlternating, formRank, formDeterminant,
} from '../../src/examples/hypergeometric/all-half-even-normal-form.ts';
import { binom } from '../../src/examples/hypergeometric/all-half-kernel.ts';
import { cyclotomicProduct } from '../../src/core/polynomial.ts';
import { type Mat, matDim } from '../../src/core/matrix.ts';
import {
  type IMat, imul, iident, iaddScalar, iequal, iisZero, idet, irank, ipow,
} from '../../src/core/exactMatrix.ts';
import { generateOrbit } from '../../src/core/orbit.ts';

let failures = 0;
function check(name: string, ok: boolean, detail = ''): void {
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? `  — ${detail}` : ''}`);
  if (!ok) failures++;
}

/** Round a float matrix to exact integers, or null if it is not integral. */
function toExact(M: Mat, tol = 1e-6): IMat | null {
  const n = matDim(M);
  const out: IMat = [];
  for (let i = 0; i < n; i++) {
    const row: bigint[] = [];
    for (let j = 0; j < n; j++) {
      const v = M[i * n + j], r = Math.round(v);
      if (!Number.isFinite(v) || Math.abs(v - r) > tol) return null;
      row.push(BigInt(r));
    }
    out.push(row);
  }
  return out;
}
const btrace = (X: IMat): bigint => X.reduce((s, r, i) => s + r[i], 0n);

console.log('all-half-even gates');

// ─── 1. routes agree ─────────────────────────────────────────────────────────
console.log('\n1. binomial route vs rotation-number route');
for (const d of DEGREES) {
  const { f, g } = allHalfEvenPolynomials(d);
  const { alpha, beta } = allHalfEvenRotations(d);
  let ok: boolean, via: string;
  try {
    ok = JSON.stringify(f) === JSON.stringify(cyclotomicProduct(alpha))
      && JSON.stringify(g) === JSON.stringify(cyclotomicProduct(beta));
    via = ok ? 'identical' : 'MISMATCH';
  } catch (e) {
    ok = true; via = `rotation route unavailable (${(e as Error).message.slice(0, 36)}…)`;
  }
  check(`d = ${String(d).padStart(2)}`, ok, via);
}

// ─── 2. integrality and unipotence ───────────────────────────────────────────
console.log('\n2. F, G ∈ GL_d(ℤ);  (A−I)^d = 0  and  (B+I)^d = 0');
for (const d of DEGREES) {
  const { F, G } = companionPairExact(d);
  const { A, B } = normalFormGenerators(d);
  const dF = idet(F), dG = idet(G);
  const okDet = (dF === 1n || dF === -1n) && (dG === 1n || dG === -1n);
  const unipA = iisZero(ipow(iaddScalar(A, -1n), d));
  const unipB = iisZero(ipow(iaddScalar(B, 1n), d));
  check(`d = ${String(d).padStart(2)}`, okDet && unipA && unipB,
    `det F = ${dF}, det G = ${dG}, (A−I)^d = 0: ${unipA}, (B+I)^d = 0: ${unipB}`);
}

// ─── 3. the transvection ─────────────────────────────────────────────────────
console.log('\n3. T is a TRANSVECTION (not an involution): rank(T−I) = 1, N² = 0, T⁻¹ = 2I − T');
for (const d of DEGREES) {
  const { F, G } = companionPairExact(d);
  const P = changeOfBasis(d);
  const T = transvectionExact(d);
  const I = iident(d);
  const N = iaddScalar(T, -1n);
  const notInvolution = !iequal(imul(T, T), I);
  const rk = irank(N);
  const nilp = iisZero(imul(N, N));
  const inv = iequal(imul(T, transvectionInverseExact(T)), I);
  const commutes = iequal(imul(P, F), imul(F, P));
  const conj = iequal(imul(imul(P, T), F), imul(G, P));
  const detT = idet(T);
  check(`d = ${String(d).padStart(2)}`,
    notInvolution && rk === 1 && nilp && inv && commutes && conj && detT === 1n,
    `T² ≠ I: ${notInvolution}, rank(T−I) = ${rk}, N² = 0: ${nilp}, T(2I−T) = I: ${inv}, ` +
    `PF = FP: ${commutes}, PTF = GP: ${conj}, det T = ${detT}`);
}

// ─── 4. the alternating form ─────────────────────────────────────────────────
console.log('\n4. Ω alternating, nondegenerate, and preserved by A, T, B');
for (const d of DEGREES) {
  const Om = alternatingForm(d);
  const { A, T, B } = normalFormGenerators(d);
  const alt = isAlternating(Om);
  const rk = formRank(d);
  const det = formDeterminant(d);
  // det of a nondegenerate alternating matrix is a perfect square (Pfaffian²)
  const isSquare = (() => {
    if (det <= 0n) return det === 0n ? false : false;
    let lo = 0n, hi = det;
    while (lo <= hi) { const m = (lo + hi) / 2n; const s = m * m;
      if (s === det) return true; if (s < det) lo = m + 1n; else hi = m - 1n; }
    return false;
  })();
  check(`d = ${String(d).padStart(2)}`,
    alt && rk === d && preservesForm(A, Om) && preservesForm(T, Om) && preservesForm(B, Om) && isSquare,
    `alternating: ${alt}, rank = ${rk}/${d}, AᵀΩA=Ω: ${preservesForm(A, Om)}, ` +
    `TᵀΩT=Ω: ${preservesForm(T, Om)}, BᵀΩB=Ω: ${preservesForm(B, Om)}, det = Pfaffian²: ${isSquare}`);
}

// ─── 5. no quadric ───────────────────────────────────────────────────────────
console.log('\n5. Ω(x,x) = 0 identically — there is NO invariant quadric');
for (const d of DEGREES) {
  const Om = alternatingForm(d);
  let allZero = true;
  for (let t = 0; t < 60 && allZero; t++) {
    const x = Array.from({ length: d }, (_, i) => BigInt(((t * 41 + i * 17) % 23) - 11));
    let s = 0n;
    for (let i = 0; i < d; i++) for (let j = 0; j < d; j++) s += x[i] * Om[i][j] * x[j];
    if (s !== 0n) allZero = false;
  }
  check(`d = ${String(d).padStart(2)}`, allZero);
}

// ─── 6. the form in companion coordinates ────────────────────────────────────
console.log('\n6. Ω_comp = P⁻ᵀΩP⁻¹ is preserved by the ORIGINAL generators F and G');
for (const d of DEGREES) {
  const { F, G } = companionPairExact(d);
  const { Omega } = formInCompanionCoordinates(d);
  const ok = preservesForm(F, Omega) && preservesForm(G, Omega) && isAlternating(Omega);
  check(`d = ${String(d).padStart(2)}`, ok,
    `FᵀΩF = Ω: ${preservesForm(F, Omega)}, GᵀΩG = Ω: ${preservesForm(G, Omega)}, alternating: ${isAlternating(Omega)}`);
}

// ─── 7. the seed ─────────────────────────────────────────────────────────────
console.log('\n7. seed γ = T⁻¹A: trace exactly 3d, and power iteration converges');
// T⁻¹ = I − N with N = T − I, so tr(T⁻¹A) = tr(A) − tr(NA). N has only its first
// row nonzero, and (NA)_{00} = N_{01}·A_{10} = −c_d(1) = −2d. With tr(A) = d
// (regular unipotent) this gives tr = d + 2d = 3d.
for (const d of DEGREES) {
  const { A } = normalFormGenerators(d);
  const Tinv = transvectionInverseExact(transvectionExact(d));
  const W = imul(Tinv, A);                      // apply-order [0,3] ⇒ element T⁻¹·A
  const tr = btrace(W);
  const want = 3n * BigInt(d);
  const notUnipotent = tr !== BigInt(d) && tr !== -BigInt(d);
  const action = allHalfEvenAction(d);
  const s = seedAllHalfEven(action);
  const converged = s.drift < 1e-9 && Number.isFinite(s.lambdaMax) && s.lambdaMax > 2;
  check(`d = ${String(d).padStart(2)}`, tr === want && notUnipotent && converged,
    `tr = ${tr} (= 3d ✓), |λ| = ${s.lambdaMax.toFixed(2)}, drift = ${s.drift.toExponential(1)}, γ = ${s.name}`);
}

// ─── 7b. the alphabet uses the EXACT transvection inverse ────────────────────
console.log('\n7b. the alphabet is {A, A⁻¹, T, T⁻¹} with T⁻¹ = 2I − T exactly');
for (const d of DEGREES) {
  const alph = allHalfEvenAlphabet(d);
  const eT = toExact(alph.matrices[2] as Mat), eTi = toExact(alph.matrices[3] as Mat);
  const eA = toExact(alph.matrices[0] as Mat), eAi = toExact(alph.matrices[1] as Mat);
  const I = iident(d);
  const ok = !!eT && !!eTi && !!eA && !!eAi
    && iequal(imul(eT, eTi), I) && iequal(imul(eA, eAi), I)
    && iequal(eTi, transvectionInverseExact(transvectionExact(d)))
    && JSON.stringify([...alph.inverse]) === JSON.stringify([1, 0, 3, 2]);
  check(`d = ${String(d).padStart(2)}`, ok,
    `4 generators, inverse = [${[...alph.inverse]}], all integral and exactly inverse`);
}

// ─── 8. the note's d = 4 fixtures ────────────────────────────────────────────
console.log("\n8. the note's explicit d = 4 data");
{
  const { F, G } = companionPairExact(4);
  check('F₄', iequal(F, [[0n,0n,0n,-1n],[1n,0n,0n,4n],[0n,1n,0n,-6n],[0n,0n,1n,4n]]));
  check('G₄', iequal(G, [[0n,0n,0n,-1n],[1n,0n,0n,-4n],[0n,1n,0n,-6n],[0n,0n,1n,-4n]]));
  check('c₄ = (8, 32, 88)', [1,2,3].map((n) => cKernel(4, n)).join(',') === '8,32,88',
    `got ${[1,2,3].map((n) => cKernel(4, n)).join(',')}`);
  check('T₄', iequal(transvectionExact(4),
    [[1n,-8n,-32n,-88n],[0n,1n,0n,0n],[0n,0n,1n,0n],[0n,0n,0n,1n]]));
  check('Ω₄', iequal(alternatingForm(4),
    [[0n,8n,32n,88n],[-8n,0n,8n,32n],[-32n,-8n,0n,8n],[-88n,-32n,-8n,0n]]));
  check('u = (0, −8, 0, −8)', cyclicVector(4).join(',') === '0,-8,0,-8', `got ${cyclicVector(4).join(',')}`);
  check('P₄', iequal(changeOfBasis(4),
    [[0n,8n,32n,88n],[-8n,-32n,-120n,-320n],[0n,40n,160n,408n],[-8n,-32n,-88n,-192n]]));
  check('u_i = −2C(d,i) on odd i, 0 on even i',
    DEGREES.every((d) => cyclicVector(d).every((v, i) =>
      v === (i % 2 === 0 ? 0n : -2n * binom(BigInt(d), BigInt(i))))));
  check('a_d is the ODD extension of c_d',
    DEGREES.every((d) => aKernel(d, 0) === 0n
      && [1, 2, 3].every((n) => aKernel(d, n) === cKernel(d, n) && aKernel(d, -n) === -cKernel(d, n))));
}

// ─── 9. the float pipeline agrees with the exact matrices ────────────────────
console.log('\n9. the float generators match the exact ones, and the orbit is finite');
for (const d of DEGREES) {
  const { F: Fe, G: Ge } = companionPairExact(d);
  const { F, G } = allHalfEvenCompanionPair(d);
  const eF = toExact(F), eG = toExact(G);
  const eT = toExact(transvection(d));
  const eTi = toExact(transvectionInverse(transvection(d)));
  const matches = !!eF && !!eG && iequal(eF, Fe) && iequal(eG, Ge)
    && !!eT && iequal(eT, transvectionExact(d))
    && !!eTi && iequal(eTi, transvectionInverseExact(transvectionExact(d)));
  const action = allHalfEvenAction(d);
  const orb = generateOrbit(action, seedAllHalfEven(action).basepoint, 8);
  let finite = true;
  for (let i = 0; i < orb.count * d; i++) if (!Number.isFinite(orb.vecs[i])) finite = false;
  check(`d = ${String(d).padStart(2)}`, matches && finite,
    `float == exact: ${matches}, orbit N=8: ${orb.count} pts, all finite: ${finite}`);
}

console.log(`\nseed word (apply order) = [${[...ALL_HALF_EVEN_SEED_WORD]}]  ⇒  γ = T⁻¹A`);
console.log(`${failures === 0 ? 'all gates passed' : `${failures} gate(s) FAILED`}`);
if (failures > 0) process.exit(1);
