/**
 * Curated SL(3,R) / PGL(3,R) examples — convex real projective structures
 * on RP², Coxeter triangle groups and their Goldman / Vinberg deformations.
 *
 * For reflection groups, the generators are involutions (M_i² = I); we set
 * `involutions: true` so the orbit walker emits reduced Coxeter words. The
 * generator codes map 1:1 to the matrix list: code k = M_{k+1}.
 *
 * γ words are sequences of generator codes applied in order; for a length-3
 * γ = [0,1,2] the induced matrix product is M₃·M₂·M₁ (apply M₁ first → M₂ →
 * M₃; matrix product reads right-to-left).
 */

import type { Mat3R } from './action.ts';

export interface SL3RExample {
  id: string;
  label: string;
  description: string;
  generators: readonly Mat3R[];
  /** True for reflection groups (each gen is its own inverse). */
  involutions: boolean;
  /** Loxodromic γ word, as a sequence of generator codes (apply order). */
  gamma: readonly number[];
  gammaName: string;
  powerIter: number;
}

// ─── (3,3,4) Coxeter triangle group + projective deformations ──────────────
//
// Three reflection generators M₁, M₂, M₃ satisfying the abstract Coxeter
// relations M_i² = I,  (M₁M₂)³ = I,  (M₁M₃)³ = I,  (M₂M₃)⁴ = I.
//
// Parameter d ∈ (0, ½) ∪ (½, 2) ∪ (2, ∞) gives a 1-parameter family of
// faithful projective representations into SL(3,R). The matrices are
// singular at d = 0, ½, 2. For different d, the Coxeter group acts on a
// (typically) properly convex domain Ω ⊂ RP² with non-round boundary —
// these are the Goldman / Vinberg deformations of the convex projective
// triangle orbifold.
//
// Matrices courtesy of [Trettel, Mathematica]. Source is column-major GLSL
// (mat3(col0_x, col0_y, col0_z, col1_x, …)); we transpose to row-major here.

const SQRT3 = Math.sqrt(3);

function triangle334Matrices(d: number): [Mat3R, Mat3R, Mat3R] {
  // M₁: reflection across {y = 0}.
  const M1: Mat3R = [
    [1,  0, 0],
    [0, -1, 0],
    [0,  0, 1],
  ];
  // M₂: reflection across the line at angle π/3 from x-axis.
  const M2: Mat3R = [
    [-0.5,      SQRT3 / 2, 0],
    [SQRT3 / 2, 0.5,       0],
    [0,         0,         1],
  ];
  // M₃: d-parameterised reflection. Source had nine GLSL column-major
  // entries; we rebuild as row-major. Each column-k entry j = mNj0..mNj2.
  const m00 = 1 + 1 / (2 - 4 * d) + 2 / (d - 2);
  const m10 = SQRT3 / (2 - 4 * d);
  const m20 = 1 / (1 - 2 * d) + 1 / (d - 2) + 1 / d;
  const m01 = (7 * d - 2) / (2 * SQRT3 * (d - 2));
  const m11 = 0.5;
  const m21 = (2 + d * (3 * d - 4)) / (SQRT3 * d * (d - 2));
  const m02 = d * (2 - 7 * d) / (4 - 10 * d + 4 * d * d);
  const m12 = SQRT3 * d / (4 * d - 2);
  const m22 = -d * (1 + d) / (2 - 5 * d + 2 * d * d);
  const M3: Mat3R = [
    [m00, m01, m02],
    [m10, m11, m12],
    [m20, m21, m22],
  ];
  return [M1, M2, M3];
}

function triangle334Example(
  d: number,
  id: string,
  label: string,
  description: string,
): SL3RExample {
  return {
    id, label, description,
    generators: triangle334Matrices(d),
    involutions: true,
    gamma:     [0, 1, 2],
    gammaName: 'M₁M₂M₃',
    powerIter: 40,
  };
}

/**
 * Public factory for an ad-hoc (3,3,4) triangle example at parameter d.
 * Used by the demo's live-d slider; not normally listed in EXAMPLES.
 * d must avoid the singularities at 0, 1/2, 2.
 */
export function makeLiveTri334(d: number): SL3RExample {
  return triangle334Example(d, 'tri-334-live',
    `(3,3,4) triangle (d = ${d.toFixed(3)})`,
    `(3,3,4) Coxeter triangle group, deformation parameter d = ${d.toFixed(3)}`);
}

// ─── 4-involution projective representation in SL(3,R) ────────────────────
//
// Four involution generators S₁, S₂, S₃, S₄ parameterised by (a, s, t, u):
//   S₁ = [[1, -tu/s, -at], [0, -1, 0], [0, 0, -1]]
//   S₂ = [[-1, 0, 0], [-s/(tu), 1, -s/u], [0, 0, -1]]
//   S₃ = [[-1, 0, 0], [0, -1, 0], [-a/t, -u/s, 1]]
//   S₄ = (rational closed form in a, s, t, u; see fourReflectionMatrices)
//
// All four have eigenvalues 1, −1, −1 (trace −1, det +1) — POINT involutions
// with a 1-D fixed line and a 2-D negated plane, as opposed to the previous
// R_i which were hyperplane reflections (eigenvalues 1, 1, −1).
//
// Domain: a ≠ 2, t ≠ 0, s ≠ 0, u ≠ 0 (the only singularities are rational
// poles in S₄). γ = S₁S₃ is loxodromic ⇔ |a| > 2 (trace = a²−1,
// eigenvalues 1, ((a²−2)±√((a²−2)²−4))/2). Default s = t = u = 1.

function fourReflectionMatrices(
  a: number, s: number, t: number, u: number,
): [Mat3R, Mat3R, Mat3R, Mat3R] {
  if (a === 2) throw new Error(`fourReflection: a = 2 is a singularity of S₄`);
  if (s === 0 || t === 0 || u === 0) {
    throw new Error(`fourReflection: s, t, u must all be nonzero (got s=${s}, t=${t}, u=${u})`);
  }
  if (a * a <= 4) {
    // not fatal, but γ won't be loxodromic — flag it
    throw new Error(`fourReflection: γ = S₁S₃ needs |a| > 2 to be loxodromic (got a = ${a})`);
  }

  const S1: Mat3R = [
    [1, -(t * u) / s, -a * t],
    [0, -1,            0],
    [0,  0,           -1],
  ];
  const S2: Mat3R = [
    [-1,            0,  0],
    [-s / (t * u),  1, -s / u],
    [ 0,            0, -1],
  ];
  const S3: Mat3R = [
    [-1,        0,        0],
    [ 0,       -1,        0],
    [-a / t,  -u / s,     1],
  ];

  const am2  = a - 2;
  const am2sq = am2 * am2;
  const S4: Mat3R = [
    [-a / am2,                -(4 * a * t * u) / (am2sq * s), -(2 * t) / am2],
    [ s / (t * u),             (2 + a) / am2,                  s / u],
    [-2 / (am2 * t),          -(4 * a * u) / (am2sq * s),     -a / am2],
  ];
  return [S1, S2, S3, S4];
}

function fourReflectionExample(
  a: number, s: number, t: number, u: number,
  id: string, label: string, description: string,
): SL3RExample {
  return {
    id, label, description,
    generators: fourReflectionMatrices(a, s, t, u),
    involutions: true,
    gamma:     [0, 2],
    gammaName: 'S₁S₃',
    powerIter: 40,
  };
}

export const EXAMPLES: readonly SL3RExample[] = [
  // The (3,3,4) family is parameterised by d ∈ (½, 2) \ {0, ½, 2}. The
  // browser demo exposes d as a live slider (see makeLiveTri334); we keep
  // one discrete instance here so validation has something to chew on.
  triangle334Example(1.0,
    'tri-334-d1.0', '(3,3,4) deformation (d = 1)',
    'Coxeter triangle group; deformation parameter d (see live slider in browser)'),
  // ── 4-reflection rep (a, s, t, u); requires |a| > 2 ──
  fourReflectionExample(2.5, 1, 1, 1,
    'four-refl-a2.5', '4-reflection rep (a=2.5, s=t=u=1)',
    'baseline: a just past discreteness threshold, all gauges unit'),
  fourReflectionExample(3.0, 2.7, 1.8, 2.3,
    'four-refl-big-a3', '4-reflection rep (a=3, s=2.7, t=1.8, u=2.3)',
    'bigger gauges; a=3'),
  fourReflectionExample(3.5, 3.5, 4.0, 1.6,
    'four-refl-big-a3.5', '4-reflection rep (a=3.5, s=3.5, t=4.0, u=1.6)',
    'asymmetric bigger gauges; a=3.5'),
  fourReflectionExample(4.0, 1.4, 3.2, 2.1,
    'four-refl-big-a4', '4-reflection rep (a=4, s=1.4, t=3.2, u=2.1)',
    'larger a, mixed gauges'),
  fourReflectionExample(5.0, 2.0, 3.0, 2.5,
    'four-refl-big-a5', '4-reflection rep (a=5, s=2, t=3, u=2.5)',
    'large a, mid gauges'),
];

export function exampleById(id: string): SL3RExample {
  const ex = EXAMPLES.find((e) => e.id === id);
  if (!ex) throw new Error(`unknown sl3r example id: ${id}`);
  return ex;
}
