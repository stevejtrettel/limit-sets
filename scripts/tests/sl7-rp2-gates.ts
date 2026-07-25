/**
 * Correctness gates for the sl7rp2 family — the RP² restriction of the SL(7,ℝ)
 * Goldman–Parker triple.
 *
 * Pins:
 *   1. The invariant subspace is exactly 3-dimensional and exactly invariant
 *      (residual ≈ 0), with a clean rank gap.
 *   2. Each restricted generator Cᵢ = B gᵢ Bᵀ is an involution (Cᵢ² = I) with
 *      det +1 and spectrum (+1, −1, −1) — a projective reflection.
 *   3. The restriction is faithful to the dynamics: the 3×3 auto-seed recovers
 *      the same dominant eigenvalue as the 7×7 seed.
 *   4. The RP² limit set is stable: the plane-embedded orbit bbox matches a
 *      recorded reference.
 *
 * Run:  node scripts/tests/sl7-rp2-gates.ts
 */

import { EXAMPLES } from '../../src/examples/projective/rp6-triples/data.ts';
import { restrictToRP2 } from '../../src/examples/projective/rp6-triples/rp2.ts';
import { matMul, matDet, matDim, type Mat } from '../../src/core/matrix.ts';
import { charPoly, polyRoots } from '../../src/core/linalg.ts';
import { seedFromLoxodromic, makeRealDominantCriterion } from '../../src/core/seed.ts';
import { generateOrbit } from '../../src/core/orbit.ts';
import { sphereEmbedding } from '../../src/examples/projective/rp2.ts';
import { embedOrbit } from '../../src/core/scene.ts';

let failures = 0;
function check(name: string, ok: boolean, detail = ''): void {
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? `  — ${detail}` : ''}`);
  if (!ok) failures++;
}
const approx = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

const ex = EXAMPLES[0];
console.log(`sl7rp2 gates — ${ex.id}`);

const r = restrictToRP2(ex);
console.log(`  dim V = ${r.dim}  invariance residual = ${r.invarianceResidual.toExponential(2)}  ` +
  `spectral gap = ${r.spectralGap === Infinity ? '∞' : r.spectralGap.toExponential(2)}`);

// ─── 1. invariant subspace ───────────────────────────────────────────────────
check('invariant subspace is 3-dimensional', r.dim === 3);
check('subspace is exactly invariant (residual < 1e-12)', r.invarianceResidual < 1e-12,
  `residual = ${r.invarianceResidual.toExponential(2)}`);
check('clean rank gap (λ₃/λ₄ > 1e6)', r.spectralGap > 1e6);

// ─── 2. projective reflections ───────────────────────────────────────────────
function involutionResidual(M: Mat): number {
  const n = matDim(M);
  const M2 = matMul(M, M);
  let e = 0;
  for (let i = 0; i < n * n; i++) e = Math.max(e, Math.abs(M2[i] - (i % (n + 1) === 0 ? 1 : 0)));
  return e;
}
r.generators.forEach((C, i) => {
  check(`C${i + 1} is an involution`, involutionResidual(C) < 1e-9);
  check(`C${i + 1} det = +1`, approx(matDet(C), 1, 1e-9), `det = ${matDet(C).toFixed(6)}`);
  // spectrum (+1, −1, −1): two eigenvalues at −1, one at +1
  const eigs = polyRoots(charPoly([...Array(3)].map((_, a) => [...Array(3)].map((__, b) => C[a * 3 + b]))));
  const reals = eigs.map((z) => z.re).sort((a, b) => a - b);
  const isReflection = approx(reals[0], -1, 1e-6) && approx(reals[1], -1, 1e-6) && approx(reals[2], 1, 1e-6);
  check(`C${i + 1} spectrum is (+1, −1, −1) — a projective reflection`, isReflection,
    `eigs = ${reals.map((x) => x.toFixed(4)).join(', ')}`);
});

// ─── 3. faithful dynamics ────────────────────────────────────────────────────
const criterion = makeRealDominantCriterion({ expand: 1.05 });
const s3 = seedFromLoxodromic(r.action, { criterion, labels: ['g₁', 'g₂', 'g₃'] });
console.log(`  3×3 seed: γ = ${s3.name}  |λ_max| = ${s3.lambdaMax.toFixed(6)}  (7×7 was ${r.lambdaMax.toFixed(6)})`);
check('3×3 seed recovers the 7×7 dominant eigenvalue', approx(s3.lambdaMax, r.lambdaMax, 1e-6));

// ─── 4. RP² bbox stability (sphere embedding — always bounded on S²) ──────────
const DEPTH = 14;
const orbit = generateOrbit(r.action, r.basepoint, DEPTH);
const pts = new Float64Array(orbit.count * 3);
const kept = embedOrbit(sphereEmbedding, orbit, pts);
const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < kept; i++) {
  for (let k = 0; k < 3; k++) {
    const v = Math.abs(pts[i * 3 + k]);      // fold antipodes: eigenbasis sign is arbitrary
    if (v < lo[k]) lo[k] = v;
    if (v > hi[k]) hi[k] = v;
  }
}
console.log(`  RP² orbit: depth=${DEPTH} words=${orbit.count} kept=${kept} (sphere cover, |coord|)`);
console.log(`  |coord| range x=[${lo[0].toFixed(5)},${hi[0].toFixed(5)}] y=[${lo[1].toFixed(5)},${hi[1].toFixed(5)}] z=[${lo[2].toFixed(5)},${hi[2].toFixed(5)}]`);

const REFERENCE: { lo: number[]; hi: number[] } | null = {
  lo: [0.00013, 0.00028, 0.00002],
  hi: [0.99956, 0.99965, 0.98888],
};
if (REFERENCE) {
  const tol = 1e-3;
  let ok = true;
  for (let k = 0; k < 3; k++) ok = ok && approx(lo[k], REFERENCE.lo[k], tol) && approx(hi[k], REFERENCE.hi[k], tol);
  check('RP² bbox matches reference', ok, `hi=[${hi.map((v) => v.toFixed(4)).join(', ')}]`);
}

console.log(failures === 0 ? '\nALL GATES PASSED' : `\n${failures} GATE(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
