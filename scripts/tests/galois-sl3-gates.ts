/**
 * Correctness gates for the galois-sl3 family (SL(3,𝒪_K) ↪ SL(3)×SL(3) ⊂ SL(6,ℝ)).
 *
 * Pins, in the order the construction depends on them:
 *   1. ARITHMETIC — every catalog t is a unit: t + t^σ ∈ ℤ and t·t^σ = ±1. This
 *      is what puts 1/t in 𝒪_K, hence the group in SL(3, 𝒪_K).
 *   2. FAMILY — det A(t) = det B(t) = 1 identically, and spec A = spec B =
 *      spec AB = {−t, 1, −1/t}, at t and at t^σ.
 *   3. BLOCK SUM — matBlockDiag is a homomorphism: diag(P,Q)·diag(P',Q') =
 *      diag(PP', QQ'), so the 6×6 group really is the image of the two places.
 *   4. THE DEGENERACY the seeding is designed around — an orbit seeded from a
 *      single factor's proximal fixed point NEVER leaves that factor's
 *      coordinate 3-plane, while the joined seed's orbit does. If this ever
 *      flips, the RP⁵ picture has silently become an RP² one.
 *   5. SEED — a word proximal in BOTH factors exists, power iteration converges
 *      projectively in each, and the joined basepoint is balanced.
 *   6. STABILITY — the orbit's RP⁵ bounding box in the auto-chart matches a
 *      recorded reference.
 *
 * Run:  node scripts/tests/galois-sl3-gates.ts
 */

import { EXAMPLES, exampleById } from '../../src/examples/galois-sl3/catalog.ts';
import { generatorsAt } from '../../src/examples/galois-sl3/family.ts';
import { factorActions, galoisAction, seedGalois, seedFactor } from '../../src/examples/galois-sl3/recipe.ts';
import { quadraticUnit } from '../../src/examples/galois-sl3/quadratic.ts';
import { matBlockDiag, matDet, matMul, matDim, type Mat } from '../../src/core/matrix.ts';
import { charPoly, polyRoots, complexAbs } from '../../src/core/linalg.ts';
import { generateOrbit } from '../../src/core/orbit.ts';
import { fitAutoChartEmbedding } from '../../src/core/chart.ts';
import { embedOrbit } from '../../src/core/scene.ts';

let failures = 0;
function check(name: string, ok: boolean, detail = ''): void {
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? `  — ${detail}` : ''}`);
  if (!ok) failures++;
}
const approx = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;
const rowsOf = (M: Mat): number[][] => {
  const n = matDim(M);
  return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => M[i * n + j]));
};
/** Eigenvalue moduli, descending. */
const mods = (M: Mat): number[] => polyRoots(charPoly(rowsOf(M))).map(complexAbs).sort((a, b) => b - a);

console.log('galois-sl3 gates');

// ─── 1. arithmetic: every catalog t is a unit ────────────────────────────────
console.log('\n1. arithmetic (t is a unit of 𝒪_K)');
for (const ex of EXAMPLES) {
  const { t, tSigma, trace, norm, label } = ex.unit;
  const ok = approx(t + tSigma, trace, 1e-9) && approx(t * tSigma, norm, 1e-9)
    && Number.isInteger(trace) && (norm === 1 || norm === -1);
  check(`${ex.id.padEnd(8)} t = ${label}`, ok,
    `tr = ${(t + tSigma).toFixed(9)}, N = ${(t * tSigma).toFixed(9)}`);
}
// a non-unit must be rejected outright: t = √2 has N = −2, so 1/t ∉ ℤ[√2]
{
  let threw = false;
  try { quadraticUnit('bad', '√2', 0, 1, 1, 2); } catch { threw = true; }
  check('non-unit (√2, N = −2) is rejected', threw);
}

// ─── 2. the family: det and spectrum at both places ──────────────────────────
console.log('\n2. family: det = 1 and spec = {−t, 1, −1/t}');
for (const ex of EXAMPLES) {
  for (const [place, tt] of [['t', ex.unit.t], ['t^σ', ex.unit.tSigma]] as [string, number][]) {
    const [A, B] = generatorsAt(tt);
    const detOk = approx(matDet(A), 1, 1e-9) && approx(matDet(B), 1, 1e-9);
    const want = [Math.abs(tt), 1, Math.abs(1 / tt)].sort((a, b) => b - a);
    const specOk = [A, B, matMul(A, B)].every((M) =>
      mods(M).every((v, i) => approx(v, want[i], 1e-9)));
    check(`${ex.id.padEnd(8)} at ${place.padEnd(3)}: det = 1 and spec = {−t, 1, −1/t}`, detOk && specOk);
  }
}

// ─── 3. block sum is a homomorphism ──────────────────────────────────────────
console.log('\n3. matBlockDiag is a homomorphism');
{
  const u = exampleById('phi').unit;
  const [A, B] = generatorsAt(u.t);
  const [As, Bs] = generatorsAt(u.tSigma);
  const lhs = matMul(matBlockDiag([A, As]), matBlockDiag([B, Bs]));
  const rhs = matBlockDiag([matMul(A, B), matMul(As, Bs)]);
  let res = 0;
  for (let i = 0; i < 36; i++) res = Math.max(res, Math.abs(lhs[i] - rhs[i]));
  check('diag(A,A^σ)·diag(B,B^σ) = diag(AB, A^σB^σ)', res < 1e-12, `residual = ${res.toExponential(2)}`);
  check('block sum has dimension 6', matDim(lhs) === 6);
}

// ─── 4. the degeneracy the seeding avoids ────────────────────────────────────
console.log('\n4. block-plane degeneracy (why seedFromBlockLoxodromic exists)');
for (const ex of EXAMPLES) {
  const action = galoisAction(ex.unit);
  const DEPTH = 8;

  // a single-factor seed stays in its coordinate 3-plane, forever
  const trapped = seedFactor(ex.unit, 0);
  const oT = generateOrbit(action, trapped.basepoint, DEPTH);
  let maxOther = 0;
  for (let i = 0; i < oT.count; i++) {
    const o = i * 6;
    maxOther = Math.max(maxOther, Math.hypot(oT.vecs[o + 3], oT.vecs[o + 4], oT.vecs[o + 5]));
  }

  // the joined seed does not
  const joined = seedGalois(ex.unit);
  const oJ = generateOrbit(action, joined.basepoint, DEPTH);
  let minOther = Infinity;
  for (let i = 0; i < oJ.count; i++) {
    const o = i * 6;
    minOther = Math.min(minOther, Math.hypot(oJ.vecs[o + 3], oJ.vecs[o + 4], oJ.vecs[o + 5]));
  }

  check(`${ex.id.padEnd(8)} factor seed is trapped, joined seed is not`,
    maxOther < 1e-12 && minOther > 1e-9,
    `factor-orbit max‖v₂‖ = ${maxOther.toExponential(1)}, joined-orbit min‖v₂‖ = ${minOther.toExponential(2)}`);
}

// ─── 5. the seed ─────────────────────────────────────────────────────────────
console.log('\n5. block seed (one word proximal in both factors)');
for (const ex of EXAMPLES) {
  const s = seedGalois(ex.unit);
  const both = s.blockLambdaMax.length === 2 && s.blockLambdaMax.every((l) => l > 1.001);
  check(`${ex.id.padEnd(8)} γ = ${s.name.padEnd(4)} proximal in both factors`, both && !s.fallback,
    `|λ| = [${s.blockLambdaMax.map((l) => l.toFixed(4)).join(', ')}], gap = ${s.minGap.toFixed(4)}`);
  check(`${ex.id.padEnd(8)} power iteration converged (projective drift < 1e-9)`,
    s.drift < 1e-9, `drift = ${s.drift.toExponential(2)}`);

  const n1 = Math.hypot(s.basepoint[0], s.basepoint[1], s.basepoint[2]);
  const n2 = Math.hypot(s.basepoint[3], s.basepoint[4], s.basepoint[5]);
  check(`${ex.id.padEnd(8)} joined basepoint is unit and balanced`,
    approx(Math.hypot(n1, n2), 1, 1e-12) && approx(n1, n2, 1e-12),
    `‖v₁‖ = ${n1.toFixed(9)}, ‖v₂‖ = ${n2.toFixed(9)}`);

  // each factor's component is genuinely the attracting fixed point of γ there
  const factors = factorActions(ex.unit);
  for (let f = 0; f < 2; f++) {
    const n = 3;
    const ref = s.basepoint.slice(f * 3, f * 3 + 3);
    const nr = Math.hypot(...ref);
    for (let i = 0; i < n; i++) ref[i] /= nr;
    let src = ref.slice();
    let dst = new Float64Array(n);
    for (const g of s.word) { factors[f].apply(g, src, 0, dst, 0); [src, dst] = [dst, src]; }
    const nw = Math.hypot(...src);
    let dot = 0; for (let i = 0; i < n; i++) dot += ref[i] * src[i];
    const sc = Math.sign(dot) / nw;
    let res = 0; for (let i = 0; i < n; i++) res = Math.max(res, Math.abs(ref[i] - src[i] * sc));
    check(`${ex.id.padEnd(8)} factor ${f + 1} component fixed by γ (g·ξ ∝ ξ)`, res < 1e-8,
      `residual = ${res.toExponential(2)}`);
  }
}

// ─── 6. orbit bbox stability ─────────────────────────────────────────────────
console.log('\n6. orbit stability');
const REF_ID = 'phi';
const DEPTH = 11;
{
  const ex = exampleById(REF_ID);
  const action = galoisAction(ex.unit);
  const s = seedGalois(ex.unit);
  const orbit = generateOrbit(action, s.basepoint, DEPTH);
  const chart = fitAutoChartEmbedding(orbit);
  const pts = new Float64Array(orbit.count * 3);
  const kept = embedOrbit(chart, orbit, pts);
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < kept; i++) {
    for (let k = 0; k < 3; k++) {
      const v = pts[i * 3 + k];
      if (v < lo[k]) lo[k] = v;
      if (v > hi[k]) hi[k] = v;
    }
  }
  console.log(`  orbit: ${REF_ID} depth=${DEPTH} words=${orbit.count} kept=${kept}`);
  console.log(`  bbox lo = [${lo.map((v) => v.toFixed(6)).join(', ')}]`);
  console.log(`  bbox hi = [${hi.map((v) => v.toFixed(6)).join(', ')}]`);

  // Reference recorded from the first clean run. Guards against an unintended
  // change to the engine or the seeding shifting the picture.
  const REFERENCE = {
    lo: [-943.957521, -825.092657, -797.271781],
    hi: [948.905081, 873.152659, 834.421588],
  };
  const tol = 1e-3;
  let ok = true;
  for (let k = 0; k < 3; k++) {
    ok = ok && approx(lo[k], REFERENCE.lo[k], tol) && approx(hi[k], REFERENCE.hi[k], tol);
  }
  check('orbit bbox matches reference', ok);
}

console.log(failures === 0 ? '\nALL GATES PASSED' : `\n${failures} GATE(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
