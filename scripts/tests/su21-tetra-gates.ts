/**
 * Correctness gates for the ideal-tetrahedron research family + diagnostics.
 *
 *   1. cmatDet             — reflections have det −1; det is multiplicative.
 *   2. Heisenberg lift     — boundaryFromHeisenberg lands on the null cone and
 *      is the exact inverse of heisenbergEmbedding.
 *   3. Moduli faithfulness — face p₁p₂p₃ of tetrahedronFromModuli(A,·)
 *      reproduces A; the Cartan cocycle identity holds to machine precision.
 *   4. classifyElement     — agrees with the GP dial on ι₁ι₂ι₃ (loxodromic
 *      below A*, parabolic at A*); adjacent-edge products parabolic.
 *   5. classifyMirrorPair  — vertex-sharing edges asymptotic; opposite edges
 *      not; quadrilateral sub-alphabet indexes the right edges.
 *   6. Group structure     — all 6 reflections in U(2,1), involutions; seeding
 *      works and the orbit stays on the null cone.
 *
 * Run: node scripts/tests/su21-tetra-gates.ts
 */

import {
  cidentity, cmatMul, cmatSub, cmatMaxAbs, cmatDet,
} from '../../src/core/complexMatrix.ts';
import { generateOrbit } from '../../src/core/orbit.ts';
import { nullResidual } from '../../src/examples/complex-hyperbolic/hermitian.ts';
import {
  idealTrianglePoints, idealTriangleReflections, idealTriangleProductTrace,
  goldmanDiscriminant, GP_CRITICAL_A,
} from '../../src/examples/complex-hyperbolic/recipe.ts';
import { heisenbergEmbedding } from '../../src/examples/complex-hyperbolic/embedding.ts';
import { formError } from '../../src/examples/complex-hyperbolic/validate.ts';
import {
  classifyElement, classifyMirrorPair, cartanReport, wordProduct, scanEllipticWords,
} from '../../src/examples/complex-hyperbolic/diagnostics.ts';
import {
  TETRA_EDGES, CYCLIC_SIDES, tetrahedronMirrors, tetrahedronReflections,
  tetrahedronAction, seedTetrahedron, boundaryFromHeisenberg, tetrahedronFromModuli,
  quadrilateralReflections, quadrilateralAction, seedQuadrilateral,
} from '../../src/examples/complex-hyperbolic/tetrahedron.ts';
import { getScheme } from '../../src/render/colorScheme.ts';

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

// A generic research config used throughout: mildly bent base face + p₄ off
// to the side in Heisenberg coordinates.
const CFG = tetrahedronFromModuli(0.6, [0.9, 0.35], 0.8);
const MIRRORS = tetrahedronMirrors(CFG);
const REFL = tetrahedronReflections(CFG);

// ─── 1. cmatDet ─────────────────────────────────────────────────────────────
console.log('cmatDet:');
{
  const d = cmatDet(REFL[0]);
  gate('det(ι) = −1', Math.hypot(d[0] + 1, d[1]), 1e-12);
  const dp = cmatDet(cmatMul(REFL[0], REFL[5]));
  gate('det multiplicative: det(ι₁₂ι₃₄) = 1', Math.hypot(dp[0] - 1, dp[1]), 1e-12);
}

// ─── 2. Heisenberg lift ─────────────────────────────────────────────────────
console.log('Heisenberg lift:');
{
  let worstNull = 0, worstRt = 0;
  const out = new Float64Array(3);
  for (const [zx, zy, v] of [[0, 0, 0], [1.3, -0.4, 2.1], [-0.7, 0.9, -1.5]] as const) {
    const p = boundaryFromHeisenberg([zx, zy], v);
    worstNull = Math.max(worstNull, nullResidual(p));
    if (!heisenbergEmbedding.embed(p, 0, out, 0)) { worstRt = Infinity; continue; }
    worstRt = Math.max(worstRt,
      Math.abs(out[0] - zx), Math.abs(out[1] - zy), Math.abs(out[2] - v));
  }
  gate('lift is null', worstNull, 1e-12);
  gate('embedding ∘ lift = id', worstRt, 1e-12);
}

// ─── 3. Moduli faithfulness + cocycle ───────────────────────────────────────
console.log('moduli + Cartan report:');
{
  const rep = cartanReport(CFG);
  const base = rep.triples.find((t) => t.triple.join() === '0,1,2')!;
  gate('face p₁p₂p₃ reproduces A = 0.6', Math.abs(base.A - 0.6), 1e-12);
  gate('cocycle: A₂₃₄ − A₁₃₄ + A₁₂₄ − A₁₂₃ = 0', Math.abs(rep.cocycleSum!), 1e-12);
  const rep2 = cartanReport(tetrahedronFromModuli(-0.9, [0.2, -1.1], 0.4));
  gate('cocycle (second config)', Math.abs(rep2.cocycleSum!), 1e-12);
}

// ─── 4. classifyElement vs the GP dial ──────────────────────────────────────
console.log('classifyElement:');
{
  const tri = idealTriangleReflections(...idealTrianglePoints(0.6));
  const cls = classifyElement(wordProduct(tri, [0, 1, 2]));
  gateIs('ι₁ι₂ι₃ at A = 0.6', cls.type, 'loxodromic');
  gate('f agrees with GP dial',
    Math.abs(cls.f - goldmanDiscriminant(idealTriangleProductTrace(0.6))), 1e-9);
  const triC = idealTriangleReflections(...idealTrianglePoints(GP_CRITICAL_A));
  gateIs('ι₁ι₂ι₃ at A*', classifyElement(wordProduct(triC, [0, 1, 2])).type, 'parabolic');
  // Adjacent edges (share point p₂): codes 0 = (0,1), 3 = (1,2).
  gateIs('adjacent-edge product ι₁₂ι₂₃', classifyElement(wordProduct(REFL, [0, 3])).type, 'parabolic');
}

// ─── 5. classifyMirrorPair + quadrilateral sub-alphabet ─────────────────────
console.log('classifyMirrorPair:');
{
  const shared = classifyMirrorPair(MIRRORS[0], MIRRORS[3]);  // (0,1) & (1,2) share p₂
  gateIs('vertex-sharing edges', shared.type, 'asymptotic');
  gate('  …with η = 1', Math.abs(shared.eta - 1), 1e-10);
  const opp = classifyMirrorPair(MIRRORS[0], MIRRORS[5]);     // (0,1) & (2,3) disjoint
  gateIs('opposite edges not asymptotic',
    opp.type === 'asymptotic' ? 'asymptotic' : 'non-asymptotic', 'non-asymptotic');
  // Quadrilateral sub-alphabet: consecutive sides share a vertex, opposite don't.
  const sideEdges = CYCLIC_SIDES.map((c) => TETRA_EDGES[c]);
  let ok = 1;
  for (let k = 0; k < 4; k++) {
    const a = sideEdges[k], b = sideEdges[(k + 1) % 4];
    if (!a.some((i) => b.includes(i))) ok = 0;                 // consecutive must share
    const c = sideEdges[(k + 2) % 4];
    if (a.some((i) => c.includes(i))) ok = 0;                  // opposite must not
  }
  gate('CYCLIC_SIDES incidence pattern', 1 - ok, 0.5);
}

// ─── 6. Group structure + dynamics ──────────────────────────────────────────
console.log('group structure:');
{
  let worstForm = 0, worstInv = 0;
  for (const m of REFL) {
    worstForm = Math.max(worstForm, formError(m));
    worstInv = Math.max(worstInv, cmatMaxAbs(cmatSub(cmatMul(m, m), cidentity(3))));
  }
  gate('all 6 reflections in U(2,1)', worstForm, 1e-10);
  gate('all 6 are involutions', worstInv, 1e-10);

  const action = tetrahedronAction(CFG);
  const seed = seedTetrahedron(action);
  gate('seed is loxodromic (λ − 1)', seed.lambdaMax > 1.02 ? 0 : 1, 0.5);
  gate('seed basepoint on null cone', nullResidual(seed.basepoint), 1e-8);
  const orbit = generateOrbit(action, seed.basepoint, 5);
  let worst = 0;
  for (let i = 0; i < orbit.count; i++) {
    worst = Math.max(worst, nullResidual(orbit.vecs.subarray(i * 6, i * 6 + 6)));
  }
  gate(`orbit (depth 5, ${orbit.count} words) on null cone`, worst, 1e-8);
  console.log(`      seed word: ${seed.name}, |λ| ≈ ${seed.lambdaMax.toFixed(3)}`);
}

// ─── 7. Quadrilateral sub-alphabet ──────────────────────────────────────────
console.log('quadrilateral:');
{
  const qr = quadrilateralReflections(CFG);
  gate('4 side reflections', Math.abs(qr.length - 4), 0.5);
  // Consecutive sides share an ideal vertex → products parabolic.
  let ok = 1;
  for (let k = 0; k < 4; k++) {
    if (classifyElement(cmatMul(qr[k], qr[(k + 1) % 4])).type !== 'parabolic') ok = 0;
  }
  gate('consecutive-side products parabolic', 1 - ok, 0.5);
  const qa = quadrilateralAction(CFG);
  const qs = seedQuadrilateral(qa);
  gate('quad seed loxodromic', qs.lambdaMax > 1.02 ? 0 : 1, 0.5);
  gate('quad seed on null cone', nullResidual(qs.basepoint), 1e-8);
}

// ─── 8. Color scheme K extension ────────────────────────────────────────────
console.log('color schemes:');
{
  gate("'last-gen' still K=5", Math.abs(getScheme('last-gen').categoryCount - 5), 0.5);
  gate("'last-gen:7' → K=7", Math.abs(getScheme('last-gen:7').categoryCount - 7), 0.5);
  gate("'kth-last:2:7' → K=7, stepsBack=1",
    Math.abs(getScheme('kth-last:2:7').categoryCount - 7) +
    Math.abs(getScheme('kth-last:2:7').stepsBack - 1), 0.5);
}

// ─── 9. Elliptic scan pin (the studied config) ──────────────────────────────
console.log('elliptic scan:');
{
  const scan = scanEllipticWords(REFL, 4);
  gate('CFG has the known 8 elliptic classes at ≤ 4', Math.abs(scan.elliptic.length - 8), 0.5);
}

if (failures > 0) {
  console.error(`\n${failures} gate(s) FAILED`);
  process.exit(1);
}
console.log('\nall su21-tetra gates passed');
