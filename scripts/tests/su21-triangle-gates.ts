/**
 * Correctness gates for finite (p,q,r) complex hyperbolic triangle groups.
 *
 *   1. Gram realization    — mirrors reproduce the prescribed Gram matrix
 *      (unit norms, |⟨cᵢ,cⱼ⟩| = cos π/n, triple-product phase = φ) exactly.
 *   2. Phase interval      — (4,4,4) endpoint is exactly π/4; endpoints
 *      degenerate (f² → 0).
 *   3. Vertex orders       — ellipticOrder(ιᵢιⱼ) = (4,4,4) resp. (3,3,4).
 *   4. ellipticOrder       — synthetic order-4 and infinite-order elliptics.
 *   5. Real point (φ = π)  — real matrices; orbit on the R-circle (R-Fuchsian).
 *   6. Schwartz dial       — 1213 loxodromic at the real point; f(1213)
 *      crosses 0 inside the interval (the critical phase exists) and the
 *      crossing is pinned to |f| ≤ 1e-9.
 *   7. Dynamics            — seed loxodromic, orbit on the null cone.
 *
 * Run: node scripts/tests/su21-triangle-gates.ts
 */

import { cmatMul } from '../../src/core/complexMatrix.ts';
import { cmat } from '../../src/core/complexMatrix.ts';
import { generateOrbit } from '../../src/core/orbit.ts';
import { herm, nullResidual } from '../../src/examples/complex-hyperbolic/hermitian.ts';
import { formError } from '../../src/examples/complex-hyperbolic/validate.ts';
import {
  classifyElement, ellipticOrder, wordProduct, cmat3Eigenvalues, splittingAngle,
} from '../../src/examples/complex-hyperbolic/diagnostics.ts';
import {
  triangleGroupMirrors, triangleGroupReflections, triangleGroupAction,
  trianglePhaseInterval, seedTriangleGroup, WORD_1213,
  findParabolicPhase, findEllipticPhase,
  type TriangleOrders,
} from '../../src/examples/complex-hyperbolic/triangleGroup.ts';

let failures = 0;
function gate(name: string, err: number, tol: number): void {
  const ok = Number.isFinite(err) && err <= tol;
  console.log(`  ${ok ? '✓' : '✗'} ${name}: ${err.toExponential(2)} (tol ${tol.toExponential(0)})`);
  if (!ok) failures++;
}
function gateIs(name: string, actual: string, expected: string): void {
  const ok = actual === expected;
  console.log(`  ${ok ? '✓' : '✗'} ${name}: ${actual}${ok ? '' : ` (expected ${expected})`}`);
  if (!ok) failures++;
}

const O444: TriangleOrders = [4, 4, 4];
const RHO = Math.cos(Math.PI / 4);

// ─── 1. Gram realization ────────────────────────────────────────────────────
console.log('Gram realization (4,4,4), φ = 2.0:');
{
  const PHI = 2.0;
  const [c1, c2, c3] = triangleGroupMirrors(O444, PHI);
  let worstUnit = 0;
  for (const c of [c1, c2, c3]) worstUnit = Math.max(worstUnit, Math.abs(herm(c, c)[0] - 1), Math.abs(herm(c, c)[1]));
  gate('unit polar vectors', worstUnit, 1e-12);
  const g12 = herm(c1, c2), g23 = herm(c2, c3), g31 = herm(c3, c1);
  gate('|⟨c₁,c₂⟩| = cos π/4', Math.abs(Math.hypot(...g12) - RHO), 1e-12);
  gate('|⟨c₂,c₃⟩| = cos π/4', Math.abs(Math.hypot(...g23) - RHO), 1e-12);
  gate('|⟨c₃,c₁⟩| = cos π/4', Math.abs(Math.hypot(...g31) - RHO), 1e-12);
  // triple-product phase
  const t1 = [g12[0] * g23[0] - g12[1] * g23[1], g12[0] * g23[1] + g12[1] * g23[0]];
  const tr = t1[0] * g31[0] - t1[1] * g31[1], ti = t1[0] * g31[1] + t1[1] * g31[0];
  gate('triple-product phase = φ', Math.abs(Math.atan2(ti, tr) - PHI), 1e-12);
}

// ─── 2. Phase interval ──────────────────────────────────────────────────────
console.log('phase interval:');
{
  const [lo, hi] = trianglePhaseInterval(O444);
  gate('(4,4,4) φmin = π/4 exactly', Math.abs(lo - Math.PI / 4), 1e-12);
  gate('interval symmetric about π', Math.abs(lo + hi - 2 * Math.PI), 1e-12);
  let threw = 0;
  try { triangleGroupMirrors(O444, lo - 0.01); } catch { threw = 1; }
  gate('outside interval throws', 1 - threw, 0.5);
}

// ─── 3. Vertex orders ───────────────────────────────────────────────────────
console.log('vertex rotation orders:');
for (const [orders, expect] of [[[4, 4, 4], [4, 4, 4]], [[3, 3, 4], [3, 3, 4]]] as const) {
  const refl = triangleGroupReflections(orders as TriangleOrders, 2.4);
  const pairs: readonly (readonly [number, number])[] = [[0, 1], [1, 2], [2, 0]];
  pairs.forEach(([i, j], k) => {
    const ord = ellipticOrder(cmatMul(refl[i], refl[j]), 50);
    gate(`(${orders}) order(ι${i + 1}ι${j + 1}) = ${expect[k]}`, ord === expect[k] ? 0 : 1, 0.5);
  });
}

// ─── 4. ellipticOrder synthetic ─────────────────────────────────────────────
console.log('ellipticOrder:');
{
  const D4 = cmat([[[0, 1], [0, 0], [0, 0]], [[0, 0], [1, 0], [0, 0]], [[0, 0], [0, 0], [0, -1]]]);
  gate('diag(i, 1, −i) has order 4', ellipticOrder(D4, 10) === 4 ? 0 : 1, 0.5);
  const c1 = Math.cos(1), s1 = Math.sin(1);
  const DI = cmat([[[c1, s1], [0, 0], [0, 0]], [[0, 0], [1, 0], [0, 0]], [[0, 0], [0, 0], [c1, -s1]]]);
  gate('diag(e^i, 1, e^-i) has no order ≤ 200', ellipticOrder(DI, 200) === null ? 0 : 1, 0.5);
}

// ─── 5. Real point φ = π ────────────────────────────────────────────────────
console.log('real point (R-Fuchsian):');
{
  const refl = triangleGroupReflections(O444, Math.PI);
  let worstIm = 0, worstForm = 0;
  for (const m of refl) {
    worstForm = Math.max(worstForm, formError(m));
    for (let i = 1; i < 18; i += 2) worstIm = Math.max(worstIm, Math.abs(m[i]));
  }
  gate('reflections are real matrices', worstIm, 1e-12);
  gate('reflections in U(2,1)', worstForm, 1e-10);
  const action = triangleGroupAction(O444, Math.PI);
  const seed = seedTriangleGroup(action);
  const orbit = generateOrbit(action, seed.basepoint, 9);
  let worst = 0;
  for (let i = 0; i < orbit.count; i++) {
    const o = i * 6;
    const z3r = orbit.vecs[o + 4], z3i = orbit.vecs[o + 5];
    const d = z3r * z3r + z3i * z3i;
    const y1 = (orbit.vecs[o + 1] * z3r - orbit.vecs[o] * z3i) / d;
    const y2 = (orbit.vecs[o + 3] * z3r - orbit.vecs[o + 2] * z3i) / d;
    worst = Math.max(worst, Math.abs(y1), Math.abs(y2));
  }
  gate(`orbit on the R-circle (${orbit.count} words)`, worst, 1e-8);
}

// ─── 6. The Schwartz dial: 1213 ─────────────────────────────────────────────
console.log('Schwartz dial (word 1213):');
{
  const fAt = (phi: number): number =>
    classifyElement(wordProduct(triangleGroupReflections(O444, phi), WORD_1213)).f;
  gateIs('1213 at the real point', classifyElement(
    wordProduct(triangleGroupReflections(O444, Math.PI), WORD_1213)).type, 'loxodromic');
  // f must change sign inside (π, φmax): the critical phase exists.
  const [, hi] = trianglePhaseInterval(O444);
  let lo = Math.PI, up = hi - 1e-6;
  const fLo = fAt(lo), fUp = fAt(up);
  gate('f changes sign on (π, φmax)', fLo > 0 && fUp < 0 ? 0 : 1, 0.5);
  for (let i = 0; i < 200; i++) {
    const mid = (lo + up) / 2;
    (fAt(mid) > 0 ? lo = mid : up = mid);
  }
  const phiC = (lo + up) / 2;
  gate(`f(φ*) = 0 at φ* = ${phiC.toFixed(6)}`, Math.abs(fAt(phiC)), 1e-9);
  console.log(`      critical phase φ* = ${phiC.toFixed(10)}  (${((phiC - Math.PI) / (hi - Math.PI) * 100).toFixed(1)}% of the way to the wall)`);
}

// ─── 6b. Eigenvalue diagnostics + elliptic searcher ─────────────────────────
console.log('eigenvalues + elliptic searcher:');
{
  // Cardano on a known spectrum: diag(i, 1, −i).
  const D4 = cmat([[[0, 1], [0, 0], [0, 0]], [[0, 0], [1, 0], [0, 0]], [[0, 0], [0, 0], [0, -1]]]);
  const eig = cmat3Eigenvalues(D4).map(([x, y]) => Math.atan2(y, x)).sort((a, b) => a - b);
  const expect = [-Math.PI / 2, 0, Math.PI / 2];
  gate('cmat3Eigenvalues(diag(i,1,−i)) angles',
    Math.max(...eig.map((a, i) => Math.abs(a - expect[i]))), 1e-12);

  const phiC = findParabolicPhase(O444);
  gate('findParabolicPhase exists', phiC === null ? 1 : 0, 0.5);
  gate('splitting angle ≈ 0 at φ*',
    splittingAngle(wordProduct(triangleGroupReflections(O444, phiC!), WORD_1213)), 1e-2);

  const r8 = findEllipticPhase(O444, 8);
  gate('order-8 phase found', r8 === null ? 1 : 0, 0.5);
  gate('splitting = 2π/8 exactly', Math.abs(r8!.splitting - Math.PI / 4), 1e-9);
  gate('verified projective order = 8', r8!.order === 8 ? 0 : 1, 0.5);
  const r5 = findEllipticPhase(O444, 5);
  gate('verified projective order = 5', r5!.order === 5 ? 0 : 1, 0.5);
  gate('order 4 unreachable for (4,4,4) (at the wall)',
    findEllipticPhase(O444, 4) === null ? 0 : 1, 0.5);
}

// ─── 7. Dynamics ────────────────────────────────────────────────────────────
console.log('dynamics (φ = 2.4):');
{
  const action = triangleGroupAction(O444, 2.4);
  const seed = seedTriangleGroup(action);
  gate('seed loxodromic', seed.lambdaMax > 1.02 ? 0 : 1, 0.5);
  gate('seed on null cone', nullResidual(seed.basepoint), 1e-8);
  const orbit = generateOrbit(action, seed.basepoint, 8);
  let worst = 0;
  for (let i = 0; i < orbit.count; i++) {
    worst = Math.max(worst, nullResidual(orbit.vecs.subarray(i * 6, i * 6 + 6)));
  }
  gate(`orbit on null cone (${orbit.count} words)`, worst, 1e-8);
  console.log(`      seed word: ${seed.name}, |λ| ≈ ${seed.lambdaMax.toFixed(3)}`);
}

if (failures > 0) {
  console.error(`\n${failures} gate(s) FAILED`);
  process.exit(1);
}
console.log('\nall su21-triangle gates passed');
