/**
 * Correctness gates for the sl7 (RP⁶ three-involution) family.
 *
 * Pins:
 *   1. Each generator is an involution (M² = I) with det +1 (SL(7)).
 *   2. The auto-seed finds a real-dominant loxodromic word and power iteration
 *      lands on its attracting fixed point (drift → 0), fixed by that word:
 *      g·ξ ∝ ξ.
 *   3. The limit set is stable: the orbit's RP⁶ bounding box (in the
 *      projective-PCA auto-chart) matches a recorded reference. Guards against
 *      an unintended change to the engine / seeding shifting the picture.
 *
 * Run:  node scripts/tests/sl7-gates.ts
 */

import { EXAMPLES, seedRP6 } from '../../src/examples/projective/rp6-triples/data.ts';
import { matMul, matDet, matDim, type Mat } from '../../src/core/matrix.ts';
import { makeMatrixAction, asInvolutions } from '../../src/core/matrixAction.ts';
import { generateOrbit } from '../../src/core/orbit.ts';
import { fitAutoChartEmbedding } from '../../src/core/chart.ts';
import { embedOrbit } from '../../src/core/scene.ts';

let failures = 0;
function check(name: string, ok: boolean, detail = ''): void {
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? `  — ${detail}` : ''}`);
  if (!ok) failures++;
}
const approx = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

const ex = EXAMPLES[0];
console.log(`sl7 gates — ${ex.id}`);

// ─── 1. involution + det ─────────────────────────────────────────────────────
function involutionResidual(M: Mat): number {
  const n = matDim(M);
  const M2 = matMul(M, M);
  let r = 0;
  for (let i = 0; i < n * n; i++) r = Math.max(r, Math.abs(M2[i] - (i % (n + 1) === 0 ? 1 : 0)));
  return r;
}
for (let i = 0; i < ex.generators.length; i++) {
  check(`g${i + 1} is an involution`, involutionResidual(ex.generators[i]) < 1e-12);
  check(`g${i + 1} det = +1`, approx(matDet(ex.generators[i]), 1, 1e-9),
    `det = ${matDet(ex.generators[i]).toFixed(6)}`);
}

// ─── 2. seed ─────────────────────────────────────────────────────────────────
const action = makeMatrixAction(asInvolutions(ex.generators));
const seed = seedRP6(action);
console.log(`  seed word: γ = ${seed.name}  |λ_max| = ${seed.lambdaMax.toFixed(6)}  drift = ${seed.drift.toExponential(3)}`);
check('seed is loxodromic (|λ| > 1.05)', seed.lambdaMax > 1.05);
check('seed converged (drift < 1e-6)', seed.drift < 1e-6, `drift = ${seed.drift.toExponential(3)}`);

// basepoint fixed by the seed word (projectively): apply the whole word, compare
// directions. Keep `ref` untouched; ping-pong between two dedicated scratch buffers.
{
  const n = action.stateDim;
  const ref = seed.basepoint.slice();
  let src = seed.basepoint.slice();
  let dst = new Float64Array(n);
  for (const g of seed.word) { action.apply(g, src, 0, dst, 0); [src, dst] = [dst, src]; }
  // src now holds word·ξ (un-normalized). Projective residual: ‖ξ̂ − ±(word·ξ)̂‖.
  const norm = (v: Float64Array) => { let s = 0; for (let i = 0; i < n; i++) s += v[i] * v[i]; return Math.sqrt(s); };
  const nr = norm(ref), nw = norm(src);
  let dot = 0; for (let i = 0; i < n; i++) dot += ref[i] * src[i];
  const s = Math.sign(dot) / nw;
  let res = 0; for (let i = 0; i < n; i++) res = Math.max(res, Math.abs(ref[i] / nr - src[i] * s));
  check('basepoint fixed by seed word (g·ξ ∝ ξ)', res < 1e-8, `residual = ${res.toExponential(3)}`);
}

// ─── 3. orbit bbox stability ─────────────────────────────────────────────────
const DEPTH = 12;
const orbit = generateOrbit(action, seed.basepoint, DEPTH);
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
console.log(`  orbit: depth=${DEPTH} words=${orbit.count} kept=${kept}`);
console.log(`  bbox lo = [${lo.map((v) => v.toFixed(6)).join(', ')}]`);
console.log(`  bbox hi = [${hi.map((v) => v.toFixed(6)).join(', ')}]`);

// Reference recorded from the first clean run. The orbit lives in a rank-3
// invariant subspace of R⁷ (λ₄…λ₇ ≈ 0), so the limit set is planar in RP² ⊂ RP⁶
// and the auto-chart's z-axis is ≈ 0.
const REFERENCE: { lo: number[]; hi: number[] } | null = {
  lo: [-136.126002, -101.151594, 0],
  hi: [36.755775, 28.615980, 0],
};
if (REFERENCE) {
  const tol = 1e-3;
  let ok = true;
  for (let k = 0; k < 3; k++) {
    ok = ok && approx(lo[k], REFERENCE.lo[k], tol) && approx(hi[k], REFERENCE.hi[k], tol);
  }
  check('orbit bbox matches reference', ok);
} else {
  console.log('  (no bbox reference pinned yet — copy the printed bbox into REFERENCE to lock it)');
}

console.log(failures === 0 ? '\nALL GATES PASSED' : `\n${failures} GATE(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
