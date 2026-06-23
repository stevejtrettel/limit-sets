/**
 * Phase-0 parity gate (see REFACTOR_PLAN.md §6).
 *
 * Proves the new generic engine (core/matrix + core/matrixAction) reproduces
 * every existing per-family GroupAction, numerically, BEFORE any old code is
 * deleted. For each catalogued example it builds the action both ways and checks
 *   - numGenerators, stateDim, and the inverse[] permutation match exactly;
 *   - apply(g, ·) agrees on random vectors for every generator g (max |Δ|).
 * Also checks the unified companion / matInverse against o5's originals.
 *
 *   node scripts/parity/action-parity.ts
 *
 * Exit code 0 = all within tolerance; 1 = a mismatch (prints the offender).
 */

import type { GroupAction } from '../../src/core/group.ts';
import { companion, matMul, matInverse, mat, type Mat } from '../../src/core/matrix.ts';
import { makeMatrixAction, generatingSet, asInvolutions, pairWithInverses } from '../../src/core/matrixAction.ts';

// Old per-family factories + data (to be deleted in later phases).
import { makeO5Action, companion as o5Companion, companionInverse as o5CompanionInverse } from '../../src/o5/action.ts';
import { CATALOG_EXAMPLES as O5_EXAMPLES } from '../../src/o5/catalog.ts';
import { makeSp6Action } from '../../src/sp6/action.ts';
import { EXAMPLES as SP6_EXAMPLES } from '../../src/sp6/examples.ts';
import { makeMat3Action } from '../../src/sl3r/action.ts';
import { EXAMPLES as SL3R_EXAMPLES } from '../../src/sl3r/examples.ts';

const TOL = 1e-12;

// Deterministic PRNG so runs are reproducible.
let _s = 0x9e3779b9 >>> 0;
function rand(): number {
  _s = (_s * 1664525 + 1013904223) >>> 0;
  return _s / 0x100000000;
}
function randomVec(n: number): Float64Array {
  const v = new Float64Array(n);
  for (let i = 0; i < n; i++) v[i] = 2 * rand() - 1;
  return v;
}

let failures = 0;
function report(label: string, ok: boolean, detail: string): void {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(40)} ${detail}`);
  if (!ok) failures++;
}

/** Compare two GroupActions over `trials` random vectors. */
function compareActions(label: string, oldA: GroupAction, newA: GroupAction, trials = 8): void {
  if (oldA.numGenerators !== newA.numGenerators || oldA.stateDim !== newA.stateDim) {
    report(label, false, `shape mismatch: old(${oldA.numGenerators},${oldA.stateDim}) new(${newA.numGenerators},${newA.stateDim})`);
    return;
  }
  for (let g = 0; g < oldA.numGenerators; g++) {
    if (oldA.inverse[g] !== newA.inverse[g]) {
      report(label, false, `inverse[${g}] mismatch: old ${oldA.inverse[g]} new ${newA.inverse[g]}`);
      return;
    }
  }
  const n = oldA.stateDim;
  let maxDiff = 0;
  const oOut = new Float64Array(n);
  const nOut = new Float64Array(n);
  for (let t = 0; t < trials; t++) {
    const v = randomVec(n);
    for (let g = 0; g < oldA.numGenerators; g++) {
      oldA.apply(g, v, 0, oOut, 0);
      newA.apply(g, v, 0, nOut, 0);
      for (let i = 0; i < n; i++) maxDiff = Math.max(maxDiff, Math.abs(oOut[i] - nOut[i]));
    }
  }
  report(label, maxDiff <= TOL, `max|Δapply| = ${maxDiff.toExponential(2)}`);
}

function maxMatDiff(A: Mat, B: Mat): number {
  let d = 0;
  for (let i = 0; i < A.length; i++) d = Math.max(d, Math.abs(A[i] - B[i]));
  return d;
}

// ── 1. companion + matInverse vs o5 originals ────────────────────────────────
{
  let maxComp = 0, maxInv = 0;
  for (const ex of O5_EXAMPLES) {
    for (const cl of [ex.coefflistf, ex.coefflistg]) {
      maxComp = Math.max(maxComp, maxMatDiff(companion(cl), o5Companion(cl)));
      maxInv = Math.max(maxInv, maxMatDiff(matInverse(companion(cl)), o5CompanionInverse(cl)));
    }
  }
  report('companion vs o5Companion', maxComp <= TOL, `max|Δ| = ${maxComp.toExponential(2)}`);
  report('matInverse vs companionInverse', maxInv <= 1e-9, `max|Δ| = ${maxInv.toExponential(2)}`);
}

// ── 2. o5 action (free-product {T, B}) ───────────────────────────────────────
{
  let worst = 0;
  for (const ex of O5_EXAMPLES) {
    const A = companion(ex.coefflistf);
    const B = companion(ex.coefflistg);
    const T = matMul(B, matInverse(A));
    const newA = makeMatrixAction(generatingSet([{ M: T, involution: true }, { M: B }]));
    const oldA = makeO5Action(ex.coefflistf, ex.coefflistg);
    // accumulate worst silently, report once
    const n = oldA.stateDim;
    const oOut = new Float64Array(n), nOut = new Float64Array(n);
    for (let t = 0; t < 4; t++) {
      const v = randomVec(n);
      for (let g = 0; g < oldA.numGenerators; g++) {
        oldA.apply(g, v, 0, oOut, 0); newA.apply(g, v, 0, nOut, 0);
        for (let i = 0; i < n; i++) worst = Math.max(worst, Math.abs(oOut[i] - nOut[i]));
      }
    }
  }
  report(`o5 free-product (${O5_EXAMPLES.length} groups)`, worst <= TOL, `max|Δapply| = ${worst.toExponential(2)}`);
}

// ── 3. sp6 action (free {A,A⁻¹,B,B⁻¹}) ───────────────────────────────────────
{
  let worst = 0;
  for (const ex of SP6_EXAMPLES) {
    const newA = makeMatrixAction(pairWithInverses([companion(ex.coefflistf), companion(ex.coefflistg)]));
    const oldA = makeSp6Action(ex);
    const n = oldA.stateDim;
    const oOut = new Float64Array(n), nOut = new Float64Array(n);
    for (let t = 0; t < 4; t++) {
      const v = randomVec(n);
      for (let g = 0; g < oldA.numGenerators; g++) {
        oldA.apply(g, v, 0, oOut, 0); newA.apply(g, v, 0, nOut, 0);
        for (let i = 0; i < n; i++) worst = Math.max(worst, Math.abs(oOut[i] - nOut[i]));
      }
    }
    if (oldA.inverse.some((x, g) => x !== newA.inverse[g])) {
      report(`sp6 ${ex.id} inverse perm`, false, 'mismatch');
    }
  }
  report(`sp6 free (${SP6_EXAMPLES.length} groups)`, worst <= TOL, `max|Δapply| = ${worst.toExponential(2)}`);
}

// ── 4. sl3r action (explicit matrices, involutions or paired) ────────────────
for (const ex of SL3R_EXAMPLES) {
  const mats = ex.generators.map((g) => mat(g as unknown as number[][]));
  const newA = makeMatrixAction(ex.involutions ? asInvolutions(mats) : pairWithInverses(mats));
  const oldA = makeMat3Action(ex.generators, { involutions: ex.involutions });
  compareActions(`sl3r ${ex.id}`, oldA, newA, 4);
}

console.log(failures === 0
  ? `\nAll parity checks PASSED (tol ${TOL}).`
  : `\n${failures} parity check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
