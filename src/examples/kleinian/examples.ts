/**
 * Curated SL(2,C) examples — quasifuchsian groups and friends.
 *
 * Each entry hardcodes the generator matrices (a 2×2 complex SL(2,C) matrix
 * per letter) plus a γ word used by power iteration to land on the proximal
 * fixed point ξ₊(γ) ∈ Λ. γ must be loxodromic (|tr γ| > 2 or genuinely
 * complex) for the iteration to converge; for groups whose single generators
 * are parabolic, pick γ as a product like ab.
 *
 * Generator codes follow the action convention: 0 = a, 1 = a⁻¹, 2 = b,
 * 3 = b⁻¹, and (when more letters are present) 4 = c, 5 = c⁻¹, …
 */

import type { ComplexMat2 } from './action.ts';
import { seedFromLoxodromic, complexDominantCriterion, type Seed } from '../../core/seed.ts';
import type { GroupAction } from '../../core/group.ts';

export interface MobiusExample {
  id: string;
  label: string;
  /** Short human-readable description of the group's nature. */
  description: string;
  generators: readonly ComplexMat2[];
  /** Preview depth to load this example at. Groups with more than two
   *  generators need a shallower tree (branching is 2·gens − 1). Default 12. */
  defaultDepth?: number;
  /** Upper bound for the depth slider. With a wide alphabet the tree grows so
   *  fast that the stock max of 14 would hang the tab. Default 14. */
  maxDepth?: number;
}

const MOBIUS_LABELS = [
  'a', 'a⁻¹', 'b', 'b⁻¹', 'c', 'c⁻¹', 'd', 'd⁻¹', 'e', 'e⁻¹', 'f', 'f⁻¹',
];

/** Limit-set basepoint for a Möbius (Kleinian) group: the attracting fixed point
 *  of the shortest certified loxodromic word. Uses the COMPLEX dominant criterion
 *  — a loxodromic Möbius element's realified spectrum has a conjugate pair at the
 *  top, which the real criterion would reject. Power iteration converges
 *  projectively (the Hopf / stereographic embeddings are phase-invariant). */
export function seedKleinian(action: GroupAction): Seed {
  return seedFromLoxodromic(action, {
    criterion: complexDominantCriterion,
    labels: MOBIUS_LABELS.slice(0, action.numGenerators),
  });
}

// ─── Riley once-punctured torus groups ─────────────────────────────────────
//
//   a(z) = z + 1                    →  [[1, 1], [0, 1]]
//   b(z) = z / (t·z + 1)            →  [[1, 0], [t, 1]]
//
// Both generators are parabolic (trace 2). The commutator [a, b] has trace
// −2 (puncture cusp), so γ must be a non-commutator loxodromic word — the
// simplest is ab: tr(ab) = 2 + t. Loxodromic whenever 2 + t is not real or
// has |·| > 2.
//
// Different t values give qualitatively different limit sets:
//   - t real (e.g. 4)      → fuchsian; limit set is a topological circle
//   - t = small imaginary  → quasifuchsian; limit set is a wiggly quasicircle
//   - t = large imaginary  → near or past the Riley-slice boundary; the
//                            group degenerates and the limit set can be
//                            cusped or fail to be a proper quasicircle

function rileyExample(id: string, label: string, description: string,
                      tRe: number, tIm: number): MobiusExample {
  return {
    id, label, description,
    generators: [
      // a = [[1, 1], [0, 1]]
      { a: [1, 0], b: [1, 0], c: [0, 0], d: [1, 0] },
      // b = [[1, 0], [t, 1]]
      { a: [1, 0], b: [0, 0], c: [tRe, tIm], d: [1, 0] },
    ],
  };
}

// ─── Bianchi-style cusped hyperbolic 3-manifolds (Riley-form τ) ────────────
//
// All three follow the same Riley-form parameterisation as our riley-*
// examples — a(z) = z+1 and b(z) = z/(τz+1) — but with τ chosen from
// rings of integers of imaginary quadratic fields, giving discrete
// subgroups of Bianchi groups PSL(2, O_d). The quotient manifolds have
// finite volume and the limit set is the WHOLE sphere — not a fractal
// curve, not a Cantor set. At finite BFS depth the orbit shows a
// characteristic tile pattern (hexagonal, square, etc.) reflecting the
// lattice structure of O_d.

function bianchiTauExample(opts: {
  id: string; label: string; description: string;
  tauRe: number; tauIm: number;
}): MobiusExample {
  return {
    id: opts.id,
    label: opts.label,
    description: opts.description,
    generators: [
      { a: [1, 0], b: [1, 0], c: [0, 0],                  d: [1, 0] },
      { a: [1, 0], b: [0, 0], c: [opts.tauRe, opts.tauIm], d: [1, 0] },
    ],
  };
}

// τ = ω = (1+i√3)/2: Bianchi PSL(2, Z[ω]); the subgroup ⟨a, b⟩ is the
// figure-8 knot complement's fundamental group. Volume ≈ 2.0299.
const SQRT3 = Math.sqrt(3);
const figure8Knot = bianchiTauExample({
  id: 'figure-8-knot',
  label: 'Figure-8 knot complement',
  description: 'Bianchi PSL(2, Z[ω]); finite-volume cusp; limit set = S²; hexagonal tile pattern',
  tauRe: 0.5, tauIm: SQRT3 / 2,
});

// τ = i: Bianchi PSL(2, Z[i]) — the Picard group ring. ⟨a, b⟩ has
// commutator trace 1 (elliptic of order 3), so the quotient is an
// orbifold, not a manifold. Limit set = S²; square tile pattern from the
// Z[i] lattice + 3-fold cone singularities.
const picardSubgroup = bianchiTauExample({
  id: 'picard-i',
  label: 'Picard subgroup (τ = i)',
  description: 'Bianchi PSL(2, Z[i]) 2-generator subgroup; finite-volume orbifold; square Z[i] tiling',
  tauRe: 0, tauIm: 1,
});

// τ = 1 + i: another Bianchi PSL(2, Z[i]) subgroup with both gens
// parabolic and τ a primitive Gaussian integer. 2-cusped finite-volume
// Bianchi quotient — qualitatively the same kind of object as the
// Whitehead link complement (also 2-cusped, also Z[i] trace field), and
// the visual is "Whitehead-link-like" tile pattern.
// CAVEAT: I'm shipping this as a stand-in; I have not verified it is
// LITERALLY the Whitehead link group rather than a sister Bianchi
// quotient. If you want the exact SnapPy m129 matrices, easy to swap τ.
const whiteheadLike = bianchiTauExample({
  id: 'whitehead-like',
  label: 'Whitehead-like (Bianchi Z[i], τ = 1+i)',
  description: '2-cusped Bianchi PSL(2, Z[i]) subgroup; limit set = S²; Whitehead-link-style tile pattern (see source comment for caveat)',
  tauRe: 1, tauIm: 1,
});

// ─── Maskit slice double cusp ──────────────────────────────────────────────
//
// Different normalisation from Riley — Maskit's α is z+2 (translation by 2,
// not 1), and β is parameterised by a single complex μ:
//   α = [[1, 2], [0, 1]]
//   β = [[-iμ, -i], [-i, 0]]
//
// The Maskit slice is the set of μ giving discrete free groups (commutator
// is parabolic, once-punctured torus quotient). On the slice boundary an
// additional word becomes parabolic — a "double cusp" — and the limit set
// degenerates into a gasket-like nested-circle packing distinct from the
// Riley t = 2i picture. This is the Indra's Pearls double cusp with
// tr β = 1.958591030 + 0.011278560i, i.e. μ = i·conj(tr β), near the
// μ(0) = 2i cusp. μ MUST be genuinely complex: for real μ both generators
// preserve R̂ and the limit set collapses onto the real line.
//
// γ = αβ is loxodromic: tr = -i(μ+2), |tr| ≈ 2.81.
const MASKIT_MU: readonly [number, number] = [0.011278560, 1.958591030]; // [Re μ, Im μ]
const maskitDoubleCusp: MobiusExample = {
  id: 'maskit-double-cusp',
  label: `Maskit double cusp (μ ≈ ${MASKIT_MU[0].toFixed(4)} + ${MASKIT_MU[1].toFixed(4)}i)`,
  description: 'Maskit-slice boundary; an extra parabolic word forces a "double cusp"; gasket-like nested-circle packing',
  generators: [
    // α = [[1, 2], [0, 1]]  (z + 2)
    { a: [1, 0], b: [2, 0], c: [0, 0], d: [1, 0] },
    // β = [[-iμ, -i], [-i, 0]];  -iμ = μ_im − i·μ_re
    { a: [MASKIT_MU[1], -MASKIT_MU[0]], b: [0, -1], c: [0, -1], d: [0, 0] },
  ],
};

// ─── Round Sierpiński carpet ───────────────────────────────────────────────
//
// A limit set whose complement is a countable union of round disks with
// pairwise DISJOINT closures. That happens exactly when the group is convex
// cocompact with totally geodesic boundary: the boundary surface lifts to
// infinitely many disks, and having no parabolics is what keeps their closures
// apart (a cusp would pinch two disks together, as in the Apollonian gasket).
//
// The group here is a reflection group in 7 circles:
//   C1..C5  the RIGHT-ANGLED PENTAGON — all orthogonal to the unit circle,
//           consecutive ones orthogonal to each other, non-consecutive disjoint.
//           Centres at |z| = d on the 5th roots of unity, common radius r, with
//           r² = (1 − cos 72°)/cos 72° = √5 and d² = 1 + r² = 1 + √5.
//           (Five is forced: cos 2π/n > 0 needs n ≥ 5, the classical fact that
//           the right-angled pentagon is the smallest right-angled polygon.)
//   cap±    |z| = 1/4 and |z| = 4, disjoint from the pentagon and each other.
//
// On their own C1..C5 preserve the unit circle, so they generate a FUCHSIAN
// group whose limit set is that circle. The caps break the invariance and close
// the tube over the pentagon into a hyperideal right-angled polyhedron. Every
// pair of circles is orthogonal (δ = 0) or disjoint (|δ| > 1) — never tangent —
// where δ = (|c₁−c₂|² − r₁² − r₂²)/(2r₁r₂) is the inversive distance:
//   C_i–C_{i±1}  0            C_i–C_{i±2}  1.618034
//   C_i–cap∓     ±1.253888    cap⁻–cap⁺   −8.031250
// so Poincaré gives discreteness with no parabolics, and each vertex (two
// ultraparallel walls with a third orthogonal to both) is hyperideal. Truncating
// those vertices is what produces the totally geodesic boundary; the truncation
// circles and their translates are the carpet's round holes.
//
// Inversions are ANTI-holomorphic, so they are not SL(2,C) matrices. The
// matrices below generate the index-2 orientation-preserving subgroup — same
// limit set — as gⱼ = R(cap⁺)·R(Cⱼ). Taking cap⁺ as the base point of the
// pencil matters: cap⁺ is disjoint from every other circle, so every gⱼ is
// loxodromic (tr = 2.507776 for the walls, 16.0625 for cap⁻). Basing them at a
// wall instead would make gⱼ an involution for the two orthogonal neighbours,
// which the free-pair walker would then waste half its tree on.
const roundCarpet: MobiusExample = {
  id: 'round-carpet',
  label: 'Round Sierpiński carpet (right-angled pentagon + caps)',
  description:
    'Reflection group in 7 circles (right-angled pentagon + two concentric caps), ' +
    'orientation-preserving part. Every pair is orthogonal or disjoint — never tangent — so the ' +
    'group is discrete with no parabolics. CAVEAT: the cap pair contributes the dilation z ↦ 256z, ' +
    'so the peripheral circles spread over scales 256^k and the plane view shows only a few at once',
  // 12 codes, branching 11: depth 5 ≈ 193k words, 6 ≈ 2.1M, 7 ≈ 23M. Cap at 7 —
  // the stock max of 14 would be ≈3·10¹² nodes.
  defaultDepth: 5,
  maxDepth: 7,
  generators: [
    // g1 = R(cap⁺)·R(C1)
    { a: [2.6749612199056880, 0], b: [-4.8120076400603660, 0],
      c: [0.30075047750377287, 0], d: [-0.16718507624410558, 0] },
    // g2 = R(cap⁺)·R(C2)
    { a: [2.6749612199056880, 0], b: [-1.4869921378407382, -4.5764912225414740],
      c: [0.092937008615046141, -0.28603070140884213], d: [-0.16718507624410550, 0] },
    // g3 = R(cap⁺)·R(C3)
    { a: [2.6749612199056880, 0], b: [3.8929959578709203, -2.8284271247461907],
      c: [-0.24331224736693252, -0.17677669529663692], d: [-0.16718507624410558, 0] },
    // g4 = R(cap⁺)·R(C4)
    { a: [2.6749612199056880, 0], b: [3.8929959578709208, 2.8284271247461894],
      c: [-0.24331224736693255, 0.17677669529663684], d: [-0.16718507624410545, 0] },
    // g5 = R(cap⁺)·R(C5)
    { a: [2.6749612199056880, 0], b: [-1.4869921378407371, 4.5764912225414749],
      c: [0.092937008615046071, 0.28603070140884218], d: [-0.16718507624410558, 0] },
    // g6 = R(cap⁺)·R(cap⁻) — the concentric pair, a pure dilation z ↦ 256 z
    { a: [16, 0], b: [0, 0],
      c: [0, 0], d: [0.062500000000000000, 0] },
  ],
};

export const EXAMPLES: readonly MobiusExample[] = [
  // ── Curves ──
  // t = ±2i is the Riley-slice cusp: commutator [a,b] is parabolic, group
  // is the genuine once-punctured-torus quasifuchsian group, limit set is
  // a topological circle (quasicircle) through ∞ in the plane view.
  rileyExample('riley-2i', 'Riley cusp (t = 2i) — quasicircle',
    'once-punctured torus quasifuchsian; limit set is a quasicircle through ∞',
    0, 2),
  maskitDoubleCusp,
  // ── Filled sphere (cusped manifolds, limit set = S²) ──
  figure8Knot,
  picardSubgroup,
  whiteheadLike,
  // ── Round Sierpiński carpet (totally geodesic boundary) ──
  roundCarpet,
  // ── Cantor (Schottky) ──
  rileyExample('schottky-4', 'Schottky-Fuchsian (t = 4)',
    'real t — Cantor subset of R̂ (NOT a curve); shows as a great circle with gaps',
    4, 0),
  rileyExample('schottky-4i', 'Schottky (t = 4i)',
    'large complex t — Cantor set on the sphere, integer-translated in plane view',
    0, 4),
];

export function exampleById(id: string): MobiusExample {
  const ex = EXAMPLES.find((e) => e.id === id);
  if (!ex) throw new Error(`unknown sl2c example id: ${id}`);
  return ex;
}
