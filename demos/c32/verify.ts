/**
 * verify.ts — check the C-32 ping-pong cone certificate (background/c-32-5-30.pdf).
 *
 *   npm run verify-c32        (or:  node demos/c32/verify.ts)
 *
 * Ingredients (all from the group's defining polynomials f, g; group.ts):
 *   • the generators S, T⁻¹, E and the change of basis P (`buildHyperGroup`);
 *   • the eleven cone-certificate maps G₀…G₁₀ — the paper's "branch maps";
 *   • convex bodies, each in two dual views (extreme rays + bounding hyperplanes).
 *
 * Three checks, over integers (exit 0 iff all pass):
 *   • dominance   — K ⊆ cube Δ₀                                     (paper §3)
 *   • invariance  — GᵢK ⊆ K for every branch map Gᵢ                 (paper §3–§4)
 *   • symplectic  — S, T⁻¹ preserve an integral form Ω_U ⇒ Γ' ⊆ Sp(ℤ)
 * Dominance/invariance are cone containments `inside(Y, X)`; symplectic is gᵀ Ω_U g = Ω_U.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { FACETS_H } from './facets.ts';
import { buildHyperGroup, coneCertificateMaps, type Mat } from './group.ts';
import { invert6, matmul6, transpose6, det } from './mat6.ts';
import { exactRank } from './exactrank.ts';

// Two names for `readonly number[]`, marking the vector/covector duality at every
// signature. Documentation only — TypeScript is structural, so they are NOT enforced
// as distinct; the `applyToVector` / `applyToCovector` names do the real work.
type Vector = readonly number[];     // a column vector — a point / extreme ray
type Covector = readonly number[];   // a row covector — a bounding hyperplane

// ─── A convex body in its two dual views ─────────────────────────────────────
// A convex body (here a cone) carries both descriptions at once:
//   rays   — its extreme rays / vertices   (the body is the cone they span)
//   facets — its bounding hyperplanes h    (half-spaces { y : h·y ≥ 0 })
// Either view determines it; the containment test uses the convenient one of each.
interface ConvexBody {
  rays: readonly Vector[];
  facets: readonly Covector[];
}

// ─── Arithmetic ──────────────────────────────────────────────────────────────

function dot(h: Covector, v: Vector): number {     // the pairing ⟨covector, vector⟩
  let s = 0;
  for (let i = 0; i < 6; i++) s += h[i] * v[i];
  return s;
}
// The two ways a matrix M acts — on a column vector (left), on a row covector (right):
function applyToVector(M: Mat, v: Vector): Vector {       // M·v — entry i is (row i of M) · v
  return M.map((row) => dot(row, v));
}
function applyToCovector(M: Mat, h: Covector): Covector { // h·M — entry j is h · (column j of M)
  return M.map((_, j) => dot(h, M.map((row) => row[j])));
}
function inverse(G: Mat): number[][] {                 // our maps are integer, det ±1 ⇒ integer inverse
  return invert6(G).map((row) => row.map((x) => Math.round(x)));
}
function conjugate(g: Mat, X: Mat): Mat {              // g X g⁻¹ — the adjoint action Ad(g)
  return matmul6(matmul6(g, X), inverse(g));
}
function bracket(X: Mat, Y: Mat): Mat {                // [X, Y] = XY − YX — the Lie bracket
  const XY = matmul6(X, Y), YX = matmul6(Y, X);
  return XY.map((row, i) => row.map((x, j) => x - YX[i][j]));
}

// ─── Translate a convex body by a group element ──────────────────────────────
// Apply G to the body X. The two views transform DUALLY so the pairing h·v is
// preserved (v on the + side of h ⟺ G·v on the + side of h·G⁻¹):
//   • each vertex/ray moves by the LEFT action:    v ↦ G·v
//   • each hyperplane moves by the INVERSE:         h ↦ h·G⁻¹
// (Because  G·X = { Gy : h·y ≥ 0 } = { w : (h·G⁻¹)·w ≥ 0 },  and (h·G⁻¹)·(G·v) = h·v.)
function translate(X: ConvexBody, G: Mat): ConvexBody {
  const Ginv = inverse(G);
  return {
    rays:   X.rays.map((v) => applyToVector(G, v)),        // v ↦ G·v
    facets: X.facets.map((h) => applyToCovector(Ginv, h)), // h ↦ h·G⁻¹
  };
}

// ─── Containment ─────────────────────────────────────────────────────────────
// We choose freely between a body's two views. A point is inside body X when it is
// on the nonnegative side of every hyperplane of X; "strictly inside" asks each side
// strictly (used for full-dimensionality).
function insidePoint(point: Vector, X: ConvexBody): boolean {
  return X.facets.every((hyperplane) => dot(hyperplane, point) >= 0);
}
function strictlyInsidePoint(point: Vector, X: ConvexBody): boolean {
  return X.facets.every((hyperplane) => dot(hyperplane, point) > 0);
}

// A body Y is inside body X when every extreme point of Y is inside X. (Describe X by
// its hyperplanes and Y by its extreme rays — the convenient view of each.)
function inside(Y: ConvexBody, X: ConvexBody): boolean {
  return Y.rays.every((point) => insidePoint(point, X));
}

// A body K is invariant under a set of maps when each one sends it into itself.
function isInvariant(K: ConvexBody, maps: { G: Mat }[]): boolean {
  return maps.every(({ G }) => inside(translate(K, G), K));
}

// ─── Symplectic form ─────────────────────────────────────────────────────────
// A bilinear form on ℤ⁶ is a 6×6 matrix Q, pairing vectors by  ⟨x, y⟩ = xᵀ Q y.
//   • Q is SYMPLECTIC  ⟺  alternating (Qᵀ = −Q)  and  nondegenerate (det Q ≠ 0);
//   • a matrix g PRESERVES Q  ⟺  gᵀ Q g = Q   (then g lies in the symplectic group Sp_Q).
// A group lies in Sp_Q(ℤ) iff Q is symplectic and every generator preserves it.
const matEqual = (X: Mat, Y: Mat): boolean =>
  X.every((row, i) => row.every((x, j) => x === Y[i][j]));
const isZero = (M: Mat): boolean => M.every((row) => row.every((x) => x === 0));

function isSymplectic(Q: Mat): boolean {
  const negQ = Q.map((row) => row.map((x) => -x));
  return matEqual(transpose6(Q), negQ) && det(Q) !== 0;          // Qᵀ = −Q  and  det Q ≠ 0
}
function preserves(g: Mat, Q: Mat): boolean {
  return matEqual(matmul6(transpose6(g), matmul6(Q, g)), Q);     // gᵀ Q g = Q
}
// X lies in the symplectic Lie algebra 𝔰𝔭_Q  ⟺  Xᵀ Q + Q X = 0.
function inSymplecticLie(X: Mat, Q: Mat): boolean {
  const XtQ = matmul6(transpose6(X), Q), QX = matmul6(Q, X);
  return isZero(XtQ.map((row, i) => row.map((x, j) => x + QX[i][j])));
}

// ─── Reporting ───────────────────────────────────────────────────────────────

let allPass = true;
function report(pass: boolean, message: string): void {
  if (!pass) allPass = false;
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${message}`);
}

// ─── Inputs: the maps and the convex bodies ──────────────────────────────────

// The C-32 hypergeometric group, from its two defining polynomials (paper §1):
//   f = x⁶ − 5x⁵ + 11x⁴ − 14x³ + 11x² − 5x + 1 ,   g = x⁶ + 1 .
// buildHyperGroup derives the normal-form generators S, T⁻¹, E (u-basis) and the
// change of basis P; the eleven cone-certificate maps are words in the generators.
const F = [1, -5, 11, -14, 11, -5, 1];
const G = [1, 0, 0, 0, 0, 0, 1];
const group = buildHyperGroup(F, G);
const maps = coneCertificateMaps(group.S, group.Tinv, group.E);

// The ambient symplectic form Ω — the integral alternating form Γ' preserves, given in
// the COMPANION basis (paper; the reference verifier's OMEGA, det 64). Pull it back to
// the u-basis our generators live in:  Ω_U = Pᵀ Ω P  (a bilinear form's change of basis).
const OMEGA: Mat = [
  [ 0, -13, -22, -25, -22, -13],
  [13,   0, -13, -22, -25, -22],
  [22,  13,   0, -13, -22, -25],
  [25,  22,  13,   0, -13, -22],
  [22,  25,  22,  13,   0, -13],
  [13,  22,  25,  22,  13,   0],
];
const OMEGA_U = matmul6(transpose6(group.P), matmul6(OMEGA, group.P));

// Zariski density (paper §2): T is the transvection; N = T − I is its nilpotent log.
const T = inverse(group.Tinv);                                          // T = (T⁻¹)⁻¹
const N = T.map((row, i) => row.map((x, j) => x - (i === j ? 1 : 0)));  // N = T − I

// The six Lie-algebra generators Nᵢ = Sⁱ N S⁻ⁱ = Ad(S)ⁱ N: the orbit of N under
// conjugation by S. Period 6, since Ad(S⁶) = Ad(−I) = id (S has projective order 6).
const Ngens = [N];
for (let i = 1; i < 6; i++) Ngens.push(conjugate(group.S, Ngens[i - 1]));

// 𝔩 = ⟨N₀,…,N₅⟩ is spanned by the generators together with their pairwise brackets
// [Nᵢ,Nⱼ] (i<j): 6 + C(6,2) = 21 matrices. One round of brackets closes it — 𝔰𝔭_Q
// caps dim 𝔩 at 21, so reaching 21 here already forces 𝔩 = 𝔰𝔭_Q (no further brackets).
const lieSpan = [...Ngens];
for (let i = 0; i < 6; i++)
  for (let j = i + 1; j < 6; j++)
    lieSpan.push(bracket(Ngens[i], Ngens[j]));

// The domain K — both views: 254 extreme rays (same file rays.ts loads) + 77 facets H.
const RAYS: Vector[] = JSON.parse(readFileSync(
  fileURLToPath(new URL('./background/c32_extremal_rays.json', import.meta.url)), 'utf8',
)).rays;
const K: ConvexBody = { rays: RAYS, facets: FACETS_H };

// The dominance cube  Δ̄₀ = { y : y₀ ≥ |yᵢ| }  (paper §3), in both views:
//   • ten hyperplanes:   y₀ − yᵢ ≥ 0  and  y₀ + yᵢ ≥ 0   for i = 1..5;
//   • 2⁵ = 32 extreme rays  (1, ±1, ±1, ±1, ±1)  — the corners of |yᵢ| ≤ 1 at y₀ = 1.
const cubeFacets: Covector[] = [];
for (let i = 1; i <= 5; i++) {
  const minus = [1, 0, 0, 0, 0, 0]; minus[i] = -1; cubeFacets.push(minus);   // y₀ − yᵢ ≥ 0
  const plus  = [1, 0, 0, 0, 0, 0]; plus[i]  =  1; cubeFacets.push(plus);    // y₀ + yᵢ ≥ 0
}

// all sign patterns (±1)⁵, built by doubling, then prepend y₀ = 1
let signs: number[][] = [[]];
for (let i = 0; i < 5; i++) signs = signs.flatMap((s) => [[...s, -1], [...s, 1]]);
const cubeRays: Vector[] = signs.map((s) => [1, ...s]);

const cube: ConvexBody = { rays: cubeRays, facets: cubeFacets };

// ─── Run the certificate ─────────────────────────────────────────────────────

console.log('C-32 ping-pong cone certificate   (paper: background/c-32-5-30.pdf)');
console.log('  group:  f = x⁶ − 5x⁵ + 11x⁴ − 14x³ + 11x² − 5x + 1 ,   g = x⁶ + 1');
console.log(`  domain: K = cone(${K.rays.length} rays) = { H·y ≥ 0 }  (${K.facets.length} facets)\n`);

// Dominance — K sits inside the open dominance chamber Δ₀  (paper §3).
console.log('Dominance — K ⊆ Δ₀   (paper §3)');
report(inside(K, cube),
  `all ${K.rays.length} extreme rays satisfy y₀ ≥ |yᵢ|  ⇒  K ⊆ Δ̄₀ (the closed cube)`);
// A point strictly inside K makes K full-dimensional, so its open interior K° — an open
// set inside the closed cube — lands in the OPEN cube Δ₀, giving X⁺ = ℙ(K°) ⊆ Δ₀.
const z: Vector = [47, -1, -1, -1, -1, -1];
report(strictlyInsidePoint(z, K),
  `witness z = (47,−1,−1,−1,−1,−1) strictly inside K  ⇒  full-dimensional  ⇒  ℙ(K°) ⊆ Δ₀ (open)`);

// Invariance — every branch map sends K into itself  (paper §3–§4).
console.log('\nInvariance — GᵢK ⊆ K for all 11 branch maps   (paper §3–§4)');
report(isInvariant(K, maps), `all ${maps.length} translates GᵢK are contained in K`);

// Symplectic — Γ' = ⟨S, T⟩ preserves the integral form Ω_U, so it lies inside the
// ambient arithmetic lattice Sp_Ω(ℤ) (the group it is thin in). Closure under products
// and inverses means checking the two generators certifies the whole group.
console.log('\nSymplectic — Γ\' = ⟨S, T⟩ ⊆ Sp_Ω(ℤ)   (ambient lattice)');
report(isSymplectic(OMEGA_U),
  `Ω_U is a symplectic form — alternating (Ω_Uᵀ = −Ω_U) and nondegenerate (det = ${det(OMEGA_U)})`);
const generators = [group.S, group.Tinv];
report(generators.every((g) => preserves(g, OMEGA_U)),
  `both generators S, T⁻¹ preserve Ω_U  ⇒  all of Γ' ⊆ Sp_Ω(ℤ)`);

// Zariski density — step 1: N = T − I is nilpotent (N² = 0). This unipotence is the
// §2 hypothesis that injects a tangent vector into the Lie algebra of Γ''s closure.
console.log('\nZariski density — 𝔩 = ⟨N₀,…,N₅⟩ = 𝔰𝔭_Q   (paper §2)');
// unipotence: N = T − I is nilpotent — the §2 hypothesis that injects the tangent
// vector N into the Lie algebra of Γ''s Zariski closure.
report(isZero(matmul6(N, N)), `N = T − I is nilpotent: N² = 0  (T is unipotent)`);
// ceiling: every generator is in 𝔰𝔭_Q, so the generated 𝔩 ⊆ 𝔰𝔭_Q  (dim 𝔩 ≤ 21).
report(Ngens.every((Ni) => inSymplecticLie(Ni, OMEGA_U)),
  `each Nᵢ ∈ 𝔰𝔭_Q  (NᵢᵀΩ + ΩNᵢ = 0)  ⇒  𝔩 ⊆ 𝔰𝔭_Q`);
// floor: the 21 generators + brackets already span dimension 21 = dim 𝔰𝔭₆, so the
// sandwich 21 ≤ dim 𝔩 ≤ 21 forces 𝔩 = 𝔰𝔭_Q.
const lieRows = lieSpan.map((M) => M.flat());   // each Lie-algebra matrix → a length-36 row
const lieDim = exactRank(lieRows);              // dim 𝔩 = rank of that 21×36 matrix
report(lieDim === 21, `dim 𝔩 = ${lieDim} = dim 𝔰𝔭₆  ⇒  𝔩 = 𝔰𝔭_Q  ⇒  Γ' Zariski dense in Sp_Q`);

console.log(allPass ? '\n✓ ALL CHECKS PASSED' : '\n✗ SOME CHECKS FAILED');
process.exit(allPass ? 0 : 1);
