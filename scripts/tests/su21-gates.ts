/**
 * Correctness gates for the complex matrix engine + the SU(2,1) / CH² family.
 *
 *   1. cmatMul/cmatInverse           — M·M⁻¹ = id on a dense complex 3×3.
 *   2. Complex-engine parity         — makeComplexMatrixAction reproduces the
 *      bespoke Kleinian apply (independent reference) orbit-for-orbit.
 *   3. Cayley                        — CAYLEY* · J₂ · CAYLEY = diag(1,1,−1).
 *   4. Cartan round-trip             — idealTrianglePoints(A) reproduces A.
 *   5. Form preservation             — every catalog generator is in U(2,1).
 *   6. R-circle gate                 — the A = 0 ideal triangle orbit lies on
 *      the standard R-circle {w real, |w| = 1} ⊂ S³.
 *   7. C-circle gate                 — the C-Fuchsian orbit lies on {w₂ = 0}.
 *   8. Null-cone gate                — the A = π/4 orbit stays on ∂CH².
 *   9. Startup validator             — validateAllExamples passes.
 *
 * Run: node scripts/tests/su21-gates.ts
 */

import {
  cmat, cidentity, cmatMul, cmatInverse, cmatSub, cmatMaxAbs, cmatAdjoint,
} from '../../src/core/complexMatrix.ts';
import { makeComplexMatrixAction, pairWithComplexInverses } from '../../src/core/complexMatrixAction.ts';
import { makeMobiusAction, type ComplexMat2 } from '../../src/examples/kleinian/action.ts';
import { seedKleinian } from '../../src/examples/kleinian/examples.ts';
import { generateOrbit } from '../../src/core/orbit.ts';
import {
  BALL_FORM, CAYLEY, cartanInvariant, nullResidual, polarVector,
} from '../../src/examples/complex-hyperbolic/hermitian.ts';
import {
  idealTrianglePoints, idealTriangleReflections, complexReflection, zetaOfOrder,
  GP_CRITICAL_A, idealTriangleProductTrace, goldmanDiscriminant,
} from '../../src/examples/complex-hyperbolic/recipe.ts';
import {
  EXAMPLES, exampleById, buildAction, seedSU21, trianglePointsOf,
} from '../../src/examples/complex-hyperbolic/examples.ts';
import { validateAllExamples, formError } from '../../src/examples/complex-hyperbolic/validate.ts';

let failures = 0;
function gate(name: string, err: number, tol: number): void {
  const ok = Number.isFinite(err) && err <= tol;
  console.log(`  ${ok ? '✓' : '✗'} ${name}: ${err.toExponential(2)} (tol ${tol.toExponential(0)})`);
  if (!ok) failures++;
}

// ─── 1. Complex matrix algebra ───────────────────────────────────────────────
console.log('complex matrix algebra:');
const M = cmat([
  [[0.3, -1.2], [2.0, 0.7], [-0.4, 0.1]],
  [[1.1,  0.5], [-0.2, 0.9], [0.8, -1.5]],
  [[-0.6, 0.4], [0.3, -0.8], [1.7, 0.2]],
]);
gate('M·M⁻¹ = id', cmatMaxAbs(cmatSub(cmatMul(M, cmatInverse(M)), cidentity(3))), 1e-12);

// ─── 2. Engine parity vs bespoke Kleinian apply ──────────────────────────────
// riley-2i: a = [[1,1],[0,1]], b = [[1,0],[2i,1]].
console.log('complex engine parity (riley-2i, depth 6):');
const mobiusGens: readonly ComplexMat2[] = [
  { a: [1, 0], b: [1, 0], c: [0, 0], d: [1, 0] },
  { a: [1, 0], b: [0, 0], c: [0, 2], d: [1, 0] },
];
const bespoke = makeMobiusAction(mobiusGens);
const generic = makeComplexMatrixAction(pairWithComplexInverses([
  cmat([[mobiusGens[0].a, mobiusGens[0].b], [mobiusGens[0].c, mobiusGens[0].d]]),
  cmat([[mobiusGens[1].a, mobiusGens[1].b], [mobiusGens[1].c, mobiusGens[1].d]]),
]));
{
  const seed = seedKleinian(bespoke);
  const o1 = generateOrbit(bespoke, seed.basepoint, 6);
  const o2 = generateOrbit(generic, seed.basepoint, 6);
  let err = o1.count === o2.count ? 0 : Infinity;
  for (let i = 0; i < o1.vecs.length && err < Infinity; i++) {
    err = Math.max(err, Math.abs(o1.vecs[i] - o2.vecs[i]));
  }
  gate(`orbit parity (${o1.count} words)`, err, 1e-12);
}

// ─── 2b. Order-p complex reflections (ζ generalization) ────────────────────
console.log('order-p complex reflection:');
{
  const [p1, p2] = idealTrianglePoints(0.3);
  const c = polarVector(p1, p2);
  const z3 = zetaOfOrder(3);
  const R = complexReflection(c, z3);
  gate('R³ = id (ζ = e^{2πi/3})',
    cmatMaxAbs(cmatSub(cmatMul(R, cmatMul(R, R)), cidentity(3))), 1e-12);
  gate('R preserves the form', formError(R), 1e-12);
  gate('R⁻¹ = R_ζ̄',
    cmatMaxAbs(cmatSub(cmatInverse(R), complexReflection(c, [z3[0], -z3[1]]))), 1e-12);
}

// ─── 3. Cayley translation ───────────────────────────────────────────────────
console.log('Cayley:');
const J2 = cmat([
  [[0, 0], [0, 0], [1, 0]],
  [[0, 0], [1, 0], [0, 0]],
  [[1, 0], [0, 0], [0, 0]],
]);
gate('CAYLEY*·J₂·CAYLEY = J₁',
  cmatMaxAbs(cmatSub(cmatMul(cmatAdjoint(CAYLEY), cmatMul(J2, CAYLEY)), BALL_FORM)), 1e-15);

// ─── 4. Cartan invariant round-trip ─────────────────────────────────────────
console.log('Cartan round-trip:');
for (const A of [0, 0.3, -0.7, Math.PI / 4, 1.5]) {
  const [p1, p2, p3] = idealTrianglePoints(A);
  gate(`A = ${A.toFixed(3)}`, Math.abs(cartanInvariant(p1, p2, p3) - A), 1e-12);
}

// ─── 5. Form preservation across the catalog ────────────────────────────────
console.log('form preservation (g*Jg = J):');
for (const ex of EXAMPLES) {
  if (ex.generators) {
    for (let i = 0; i < ex.generators.length; i++) {
      gate(`${ex.id} gen ${i}`, formError(ex.generators[i].M), 1e-10);
    }
  }
  const pts = trianglePointsOf(ex);
  if (pts) {
    idealTriangleReflections(pts[0], pts[1], pts[2]).forEach((m, i) => {
      gate(`${ex.id} ι${i + 1}`, formError(m), 1e-10);
    });
  }
}

// ─── 5b. Goldman–Parker threshold ───────────────────────────────────────────
// The dial: f(τ(A)) with τ = tr(−ι₁ι₂ι₃). Pins (a) the closed form
// tan²A* = 125/3 (Goldman–Parker's s̄² = 125/3 under s = tan A — an independent
// literature cross-check of the whole construction), (b) parabolicity exactly
// at A*, (c) the sign of f on either side.
console.log('Goldman–Parker threshold:');
gate('tan²(A*) = 125/3', Math.abs(Math.tan(GP_CRITICAL_A) ** 2 - 125 / 3), 1e-9);
gate('f(τ(A*)) = 0 (ι₁ι₂ι₃ parabolic at the wall)',
  Math.abs(goldmanDiscriminant(idealTriangleProductTrace(GP_CRITICAL_A))), 1e-9);
gate('f(τ(0.95·A*)) > 0 (still loxodromic)',
  goldmanDiscriminant(idealTriangleProductTrace(0.95 * GP_CRITICAL_A)) > 0 ? 0 : 1, 0.5);
gate('f(τ(1.05·A*)) < 0 (elliptic, non-discrete)',
  goldmanDiscriminant(idealTriangleProductTrace(1.05 * GP_CRITICAL_A)) < 0 ? 0 : 1, 0.5);

// ─── 6–8. Orbit geometry gates ──────────────────────────────────────────────
/** Max deviation of an orbit from a per-point predicate on w = (z₁/z₃, z₂/z₃). */
function orbitMax(id: string, depth: number, f: (w: number[]) => number): number {
  const ex = exampleById(id);
  const action = buildAction(ex);
  const seed = seedSU21(ex, action);
  const orbit = generateOrbit(action, seed.basepoint, depth);
  let worst = 0;
  for (let i = 0; i < orbit.count; i++) {
    const o = i * 6;
    const z3r = orbit.vecs[o + 4], z3i = orbit.vecs[o + 5];
    const d = z3r * z3r + z3i * z3i;
    const x1 = (orbit.vecs[o] * z3r + orbit.vecs[o + 1] * z3i) / d;
    const y1 = (orbit.vecs[o + 1] * z3r - orbit.vecs[o] * z3i) / d;
    const x2 = (orbit.vecs[o + 2] * z3r + orbit.vecs[o + 3] * z3i) / d;
    const y2 = (orbit.vecs[o + 3] * z3r - orbit.vecs[o + 2] * z3i) / d;
    worst = Math.max(worst, f([x1, y1, x2, y2]));
  }
  return worst;
}

console.log('orbit geometry:');
gate('R-circle (A = 0): w real, |w| = 1',
  orbitMax('ideal-triangle-fuchsian', 8, ([x1, y1, x2, y2]) =>
    Math.max(Math.abs(y1), Math.abs(y2), Math.abs(Math.hypot(x1, y1, x2, y2) - 1))),
  1e-8);
gate('C-circle: w₂ = 0, |w₁| = 1',
  orbitMax('c-fuchsian', 8, ([x1, y1, x2, y2]) =>
    Math.max(Math.hypot(x2, y2), Math.abs(Math.hypot(x1, y1) - 1))),
  1e-8);
{
  const ex = exampleById('ideal-triangle-A45');
  const action = buildAction(ex);
  const seed = seedSU21(ex, action);
  const orbit = generateOrbit(action, seed.basepoint, 8);
  let worst = 0;
  for (let i = 0; i < orbit.count; i++) {
    worst = Math.max(worst, nullResidual(orbit.vecs.subarray(i * 6, i * 6 + 6)));
  }
  gate('null cone (A = π/4): |⟨z,z⟩|/|z|²', worst, 1e-6);
}

// ─── 9. Startup validator ───────────────────────────────────────────────────
console.log('startup validator:');
try {
  validateAllExamples(EXAMPLES);
} catch (e) {
  console.log(`  ✗ validateAllExamples threw: ${String(e)}`);
  failures++;
}

if (failures > 0) {
  console.error(`\n${failures} gate(s) FAILED`);
  process.exit(1);
}
console.log('\nall su21 gates passed');
