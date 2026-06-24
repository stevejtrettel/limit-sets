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
}

const MOBIUS_LABELS = ['a', 'a⁻¹', 'b', 'b⁻¹', 'c', 'c⁻¹'];

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
// is parabolic, once-punctured torus quotient). At μ ≈ 1.95859103 (real),
// an additional element becomes parabolic — the "double cusp" — and the
// limit set degenerates into a specific gasket-like nested-circle packing
// distinct from the Riley t = 2i picture.
//
// γ = αβ is loxodromic: tr = -i(μ+2), |tr| ≈ 3.96.
const MASKIT_MU = 1.95859103;
const maskitDoubleCusp: MobiusExample = {
  id: 'maskit-double-cusp',
  label: `Maskit double cusp (μ ≈ ${MASKIT_MU.toFixed(4)})`,
  description: 'Maskit-slice boundary; an extra parabolic word forces a "double cusp"; gasket-like nested-circle packing',
  generators: [
    // α = [[1, 2], [0, 1]]  (z + 2)
    { a: [1, 0], b: [2, 0], c: [0, 0], d: [1, 0] },
    // β = [[-iμ, -i], [-i, 0]]
    { a: [0, -MASKIT_MU], b: [0, -1], c: [0, -1], d: [0, 0] },
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
