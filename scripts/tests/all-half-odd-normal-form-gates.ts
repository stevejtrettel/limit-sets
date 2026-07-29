/**
 * Correctness gates for the Levelt normal form of the odd all-half tower
 * (src/examples/hypergeometric/all-half-odd-normal-form.ts).
 *
 * Everything here is EXACT integer or rational arithmetic — no tolerances. That
 * is the point of the module: the float path already draws the limit set, so the
 * normal form only earns its place if the geometry it supplies is certified.
 *
 * Pinned:
 *   1. u — the rank-one difference (G−F)e_{d−1} matches the closed form
 *      u_i = −2C(d,i) (even i), 0 (odd i).
 *   2. P — the cyclic basis is invertible and COMMUTES with F, which is why
 *      P⁻¹FP has the same companion entries as F (a property of cyclic bases,
 *      not a sign the basis change was trivial).
 *   3. R — the explicit first-row formula agrees with the conjugation
 *      P⁻¹GF⁻¹P. Checked inverse-free as P·R·F = G·P, which follows from
 *      PF = FP; R is an involution with rank(R−I) = 1 and det R = −1.
 *   4. Q — the Toeplitz form is preserved by A, R and B simultaneously.
 *   5. SIGNATURE — O(m+1, m) for d = 2m+1, by exact congruence diagonalization
 *      (Sylvester), and det Q = 2^(d²). A numeric eigensolver gets the signature
 *      WRONG here (the entries span too many orders of magnitude), which is why
 *      this is gated exactly.
 *   6. Q_comp — pushing the form back through P gives a form preserved by the
 *      original companion generators F and G.
 *   7. The note's own worked d = 5 data reproduces: u, P, b₅, and 256·Q_comp.
 *
 * Run:  node scripts/tests/all-half-odd-normal-form-gates.ts
 */

import {
  cKernel, bKernel, companionPairExact, cyclicVector, changeOfBasis,
  reflectionNormalForm, toeplitzForm, normalFormGenerators,
  formInCompanionCoordinates, formSignature, formDeterminant, preservesForm,
} from '../../src/examples/hypergeometric/all-half-odd-normal-form.ts';
import { DEGREES } from '../../src/examples/hypergeometric/all-half-odd.ts';
import {
  type IMat, imul, iident, iaddScalar, iequal, idet, irank, ifromInt, finverse,
} from '../../src/core/exactMatrix.ts';

let failures = 0;
function check(name: string, ok: boolean, detail = ''): void {
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? `  — ${detail}` : ''}`);
  if (!ok) failures++;
}

const binom = (n: bigint, k: bigint): bigint => {
  let r = 1n; for (let i = 0n; i < k; i++) r = (r * (n - i)) / (i + 1n); return r;
};

console.log('all-half-odd normal-form gates');

// ─── 1. the cyclic vector ────────────────────────────────────────────────────
console.log('\n1. u = (G−F)e_{d−1}  =  −2C(d,i) on even i, 0 on odd');
for (const d of DEGREES) {
  const { F, G } = companionPairExact(d);
  const fromMatrices = Array.from({ length: d }, (_, i) => G[i][d - 1] - F[i][d - 1]);
  const closed = cyclicVector(d);
  const ok = fromMatrices.every((v, i) => v === closed[i])
    && closed.every((v, i) => v === (i % 2 === 0 ? -2n * binom(BigInt(d), BigInt(i)) : 0n));
  check(`d = ${String(d).padStart(2)}`, ok);
}

// ─── 2. the change of basis ──────────────────────────────────────────────────
console.log('\n2. P is invertible and commutes with F  (⇒ P⁻¹FP = F, §8)');
for (const d of DEGREES) {
  const { F } = companionPairExact(d);
  const P = changeOfBasis(d);
  const det = idet(P);
  const commutes = iequal(imul(P, F), imul(F, P));
  check(`d = ${String(d).padStart(2)}`, det !== 0n && commutes,
    `det P ${det === 0n ? '= 0' : '≠ 0'}, PF = FP: ${commutes}`);
}

// ─── 3. the reflection ───────────────────────────────────────────────────────
console.log('\n3. R: P·R·F = G·P  (⇔ R = P⁻¹GF⁻¹P),  R² = I,  rank(R−I) = 1,  det R = −1');
for (const d of DEGREES) {
  const { F, G } = companionPairExact(d);
  const P = changeOfBasis(d);
  const R = reflectionNormalForm(d);
  const conj = iequal(imul(imul(P, R), F), imul(G, P));
  const invol = iequal(imul(R, R), iident(d));
  const rk = irank(iaddScalar(R, -1n));
  const dR = idet(R);
  check(`d = ${String(d).padStart(2)}`, conj && invol && rk === 1 && dR === -1n,
    `PRF = GP: ${conj}, R² = I: ${invol}, rank(R−I) = ${rk}, det R = ${dR}`);
}

// ─── 4. the invariant form ───────────────────────────────────────────────────
console.log('\n4. AᵀQA = Q, RᵀQR = Q, BᵀQB = Q  (exact)');
for (const d of DEGREES) {
  const Q = toeplitzForm(d);
  const { A, R, B } = normalFormGenerators(d);
  const ok = preservesForm(A, Q) && preservesForm(R, Q) && preservesForm(B, Q)
    && iequal(B, imul(R, A));
  check(`d = ${String(d).padStart(2)}`, ok);
}

// ─── 5. signature and determinant ────────────────────────────────────────────
console.log('\n5. signature = O(m+1, m) for d = 2m+1, and det Q = 2^(d²)');
for (const d of DEGREES) {
  const m = (d - 1) / 2;
  const s = formSignature(d);
  // The overall sign of Q is a convention; O(p,q) ≅ O(q,p). What is pinned is
  // that the two counts differ by exactly one and neither is degenerate.
  const shapeOk = s.zero === 0
    && ((s.pos === m + 1 && s.neg === m) || (s.pos === m && s.neg === m + 1));
  const det = formDeterminant(d);
  const want = 2n ** BigInt(d * d);
  check(`d = ${String(d).padStart(2)}`, shapeOk && det === want,
    `signature = (${s.pos}, ${s.neg}), zero = ${s.zero} · det Q = 2^${d * d}: ${det === want}`);
}

// ─── 6. the form back in companion coordinates ───────────────────────────────
console.log('\n6. Q_comp = P⁻ᵀQP⁻¹ is preserved by the ORIGINAL companion generators');
for (const d of DEGREES) {
  const { F, G } = companionPairExact(d);
  const { Q } = formInCompanionCoordinates(d);
  const ok = preservesForm(F, Q) && preservesForm(G, Q);
  check(`d = ${String(d).padStart(2)}`, ok, `FᵀQF = Q and GᵀQG = Q: ${ok}`);
}

// ─── 7. the note's worked d = 5 data ─────────────────────────────────────────
console.log("\n7. the note's explicit d = 5 numbers");
{
  const u = cyclicVector(5);
  check('u = (−2, 0, −20, 0, −10)', u.join(',') === '-2,0,-20,0,-10', `got (${u.join(', ')})`);

  const statedP: IMat = [
    [-2n, -10n, -50n, -170n, -450n],
    [0n, 48n, 240n, 800n, 2080n],
    [-20n, -100n, -452n, -1460n, -3700n],
    [0n, 80n, 400n, 1248n, 3040n],
    [-10n, -50n, -170n, -450n, -1002n],
  ];
  check('P matches the stated matrix', iequal(changeOfBasis(5), statedP));

  const b = [0, 1, 2, 3, 4].map((n) => bKernel(5, n));
  check('b₅ = (2, 10, 50, 170, 450)', b.join(',') === '2,10,50,170,450', `got (${b.join(', ')})`);

  check('c_d(2) = 2d² (the identity behind tr γ = −d(2d−1))',
    DEGREES.every((d) => cKernel(d, 2) === 2n * BigInt(d) * BigInt(d)));

  // The note states one convenient integral scaling: 256·Q_comp. Our Q_comp is
  // normalized to be primitive, so compare up to a positive rational factor.
  const stated: IMat = [
    [3n, 0n, -5n, 0n, 35n],
    [0n, 3n, 0n, -5n, 0n],
    [-5n, 0n, 3n, 0n, -5n],
    [0n, -5n, 0n, 3n, 0n],
    [35n, 0n, -5n, 0n, 3n],
  ];
  const { Q } = formInCompanionCoordinates(5);
  // proportional? find the first nonzero pair and check the ratio holds throughout
  let prop = true;
  let ratio: [bigint, bigint] | null = null;
  for (let i = 0; i < 5 && prop; i++) for (let j = 0; j < 5; j++) {
    const a = Q[i][j], b2 = stated[i][j];
    if (ratio === null) { if (a !== 0n || b2 !== 0n) ratio = [a, b2]; }
    if (ratio && a * ratio[1] !== b2 * ratio[0]) { prop = false; break; }
  }
  check('Q_comp is proportional to the stated 256·Q_comp', prop,
    `our primitive Q_comp row0 = (${Q[0].join(', ')}); ratio ${ratio ? `${ratio[0]}:${ratio[1]}` : 'n/a'}`);

  // Independent: does the stated matrix itself satisfy the invariance?
  const { F, G } = companionPairExact(5);
  check("the note's stated 256·Q_comp is preserved by F and G",
    preservesForm(F, stated) && preservesForm(G, stated));
}

// ─── 8. P⁻¹ really inverts P (exact rational) ────────────────────────────────
console.log('\n8. the exact rational inverse of P checks out');
for (const d of DEGREES) {
  const P = changeOfBasis(d);
  const inv = finverse(ifromInt(P));
  let ok = inv !== null;
  if (inv) {
    for (let i = 0; i < d && ok; i++) for (let j = 0; j < d; j++) {
      let accN = 0n, accD = 1n;
      for (let k = 0; k < d; k++) {
        accN = accN * inv[k][j].den + BigInt(P[i][k]) * inv[k][j].num * accD;
        accD = accD * inv[k][j].den;
      }
      const want = i === j ? 1n : 0n;
      if (accN !== want * accD) { ok = false; break; }
    }
  }
  check(`d = ${String(d).padStart(2)}`, ok);
}

console.log(`\n${failures === 0 ? 'all gates passed' : `${failures} gate(s) FAILED`}`);
if (failures > 0) process.exit(1);
