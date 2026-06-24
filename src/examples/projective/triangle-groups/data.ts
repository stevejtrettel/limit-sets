/**
 * Convex real projective structures on RP² — Coxeter (3,3,4) triangle groups
 * and 4-involution representations in SL(3,ℝ).
 *
 * This is a CATALOG: data + the small amount of glue to turn a row into a
 * GroupAction via the generic engine. Generators are flat `Mat` (built with
 * `mat([[…]])` for readability); the group is walked with `asInvolutions`
 * (every generator is a reflection / point involution). The action itself is
 * built by the consumer:
 *   makeMatrixAction(asInvolutions(example.generators))
 *
 * (Migrated from the old src/sl3r/examples.ts; matrices are now flat row-major
 * Float64Arrays instead of nested Mat3R tuples, but the numbers are identical.)
 */

import { type Mat, mat } from '../../../core/matrix.ts';
import { seedFromLoxodromic, type Seed } from '../../../core/seed.ts';
import type { GroupAction } from '../../../core/group.ts';

/** Limit-set basepoint for a convex-projective group: the attracting fixed point
 *  of the shortest CERTIFIED loxodromic word (Phase-7 uniform auto-seeding).
 *  Replaces the old fixed-γ seeding. */
export function seedTriangle(action: GroupAction): Seed {
  const labels = Array.from({ length: action.numGenerators }, (_, i) => `M${i + 1}`);
  return seedFromLoxodromic(action, { labels });
}

export interface MatrixGroupExample {
  id: string;
  label: string;
  description: string;
  /** Generator matrices (flat n×n). */
  generators: readonly Mat[];
  /** True for reflection / involution groups (each generator is its own inverse). */
  involutions: boolean;
}

// ─── (3,3,4) Coxeter triangle group + projective deformations ──────────────
//
// Three reflection generators M₁, M₂, M₃ satisfying the abstract Coxeter
// relations M_i² = I,  (M₁M₂)³ = I,  (M₁M₃)³ = I,  (M₂M₃)⁴ = I.
//
// Parameter d ∈ (0, ½) ∪ (½, 2) ∪ (2, ∞) gives a 1-parameter family of
// faithful projective representations into SL(3,ℝ). The matrices are singular
// at d = 0, ½, 2. For different d the Coxeter group acts on a (typically)
// properly convex domain Ω ⊂ RP² with non-round boundary — the Goldman /
// Vinberg deformations of the convex projective triangle orbifold.
//
// Matrices courtesy of [Trettel, Mathematica].

const SQRT3 = Math.sqrt(3);

function triangle334Matrices(d: number): [Mat, Mat, Mat] {
  // M₁: reflection across {y = 0}.
  const M1 = mat([
    [1,  0, 0],
    [0, -1, 0],
    [0,  0, 1],
  ]);
  // M₂: reflection across the line at angle π/3 from the x-axis.
  const M2 = mat([
    [-0.5,      SQRT3 / 2, 0],
    [SQRT3 / 2, 0.5,       0],
    [0,         0,         1],
  ]);
  // M₃: d-parameterised reflection.
  const m00 = 1 + 1 / (2 - 4 * d) + 2 / (d - 2);
  const m10 = SQRT3 / (2 - 4 * d);
  const m20 = 1 / (1 - 2 * d) + 1 / (d - 2) + 1 / d;
  const m01 = (7 * d - 2) / (2 * SQRT3 * (d - 2));
  const m11 = 0.5;
  const m21 = (2 + d * (3 * d - 4)) / (SQRT3 * d * (d - 2));
  const m02 = d * (2 - 7 * d) / (4 - 10 * d + 4 * d * d);
  const m12 = SQRT3 * d / (4 * d - 2);
  const m22 = -d * (1 + d) / (2 - 5 * d + 2 * d * d);
  const M3 = mat([
    [m00, m01, m02],
    [m10, m11, m12],
    [m20, m21, m22],
  ]);
  return [M1, M2, M3];
}

function triangle334Example(
  d: number, id: string, label: string, description: string,
): MatrixGroupExample {
  return {
    id, label, description,
    generators: triangle334Matrices(d),
    involutions: true,
  };
}

/**
 * Public factory for an ad-hoc (3,3,4) triangle example at parameter d. Used by
 * the demo's live-d slider; not normally listed in EXAMPLES. d must avoid the
 * singularities at 0, ½, 2.
 */
export function makeLiveTri334(d: number): MatrixGroupExample {
  return triangle334Example(d, 'tri-334-live',
    `(3,3,4) triangle (d = ${d.toFixed(3)})`,
    `(3,3,4) Coxeter triangle group, deformation parameter d = ${d.toFixed(3)}`);
}

// ─── 4-involution projective representation in SL(3,ℝ) ─────────────────────
//
// Four involution generators S₁, S₂, S₃, S₄ parameterised by (a, s, t, u), all
// with eigenvalues 1, −1, −1 (trace −1, det +1) — POINT involutions with a 1-D
// fixed line and a 2-D negated plane. Domain: a ≠ 2, t ≠ 0, s ≠ 0, u ≠ 0.
// γ = S₁S₃ is loxodromic ⇔ |a| > 2. Default s = t = u = 1.

function fourReflectionMatrices(a: number, s: number, t: number, u: number): [Mat, Mat, Mat, Mat] {
  if (a === 2) throw new Error(`fourReflection: a = 2 is a singularity of S₄`);
  if (s === 0 || t === 0 || u === 0) {
    throw new Error(`fourReflection: s, t, u must all be nonzero (got s=${s}, t=${t}, u=${u})`);
  }
  if (a * a <= 4) {
    throw new Error(`fourReflection: γ = S₁S₃ needs |a| > 2 to be loxodromic (got a = ${a})`);
  }

  const S1 = mat([
    [1, -(t * u) / s, -a * t],
    [0, -1,            0],
    [0,  0,           -1],
  ]);
  const S2 = mat([
    [-1,            0,  0],
    [-s / (t * u),  1, -s / u],
    [ 0,            0, -1],
  ]);
  const S3 = mat([
    [-1,        0,        0],
    [ 0,       -1,        0],
    [-a / t,  -u / s,     1],
  ]);

  const am2 = a - 2;
  const am2sq = am2 * am2;
  const S4 = mat([
    [-a / am2,        -(4 * a * t * u) / (am2sq * s), -(2 * t) / am2],
    [ s / (t * u),     (2 + a) / am2,                  s / u],
    [-2 / (am2 * t),  -(4 * a * u) / (am2sq * s),     -a / am2],
  ]);
  return [S1, S2, S3, S4];
}

function fourReflectionExample(
  a: number, s: number, t: number, u: number,
  id: string, label: string, description: string,
): MatrixGroupExample {
  return {
    id, label, description,
    generators: fourReflectionMatrices(a, s, t, u),
    involutions: true,
  };
}

export const EXAMPLES: readonly MatrixGroupExample[] = [
  triangle334Example(1.0,
    'tri-334-d1.0', '(3,3,4) deformation (d = 1)',
    'Coxeter triangle group; deformation parameter d (see live slider in browser)'),
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

export function exampleById(id: string): MatrixGroupExample {
  const ex = EXAMPLES.find((e) => e.id === id);
  if (!ex) throw new Error(`unknown triangle-groups example id: ${id}`);
  return ex;
}
