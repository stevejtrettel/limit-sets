/**
 * Three-involution subgroups of SL(7,ℝ) acting on RP⁶ — the "triple" examples
 * for the sl7 viewer.
 *
 * A catalog: data + the small glue to build a GroupAction from it. Each
 * generator is an INVOLUTION (M² = I), so the action is
 *   makeMatrixAction(asInvolutions(example.generators))
 * and non-backtracking words are reduced words in the free product
 * ℤ/2 ∗ ℤ/2 ∗ ℤ/2. These live in plain SL(7,ℝ) — projectively only
 * invertibility matters, there is NO invariant bilinear form (unlike the
 * integer symplectic / orthogonal families), so this is a genuine RP⁶ limit
 * set, not a boundary sphere.
 *
 * The seed criterion raises the expansion floor to 1.05: products of two of
 * these involutions are near-unipotent with eigenvalues clustered ~2e-3 around
 * 1, and numeric root-finding would let one masquerade as a weak loxodromic
 * under the default 1.001 floor. The genuine proximal words (length ≥ 3) have
 * |λ| ≈ 6–18, far above the floor.
 */

import { type Mat, mat } from '../../../core/matrix.ts';
import { seedFromLoxodromic, makeRealDominantCriterion, type Seed } from '../../../core/seed.ts';
import type { GroupAction } from '../../../core/group.ts';

const TRIPLE_LABELS = ['g₁', 'g₂', 'g₃'];

/** Loxodromic-for-seeding criterion: a single real dominant eigenvalue, floor
 *  raised to 1.05 to skip the near-unipotent length-2 products. */
const rp6Criterion = makeRealDominantCriterion({ expand: 1.05 });

/** Limit-set basepoint for a triple group: the attracting fixed point of the
 *  shortest certified loxodromic word (real dominant eigenvalue). */
export function seedRP6(action: GroupAction): Seed {
  return seedFromLoxodromic(action, {
    criterion: rp6Criterion,
    labels: TRIPLE_LABELS.slice(0, action.numGenerators),
  });
}

export interface RP6Example {
  id: string;
  label: string;
  description: string;
  generators: readonly Mat[];
  /** True if every generator is an involution (always true here; kept for the
   *  shared action-builder shape). */
  involutions: boolean;
}

// ─── goldman-parker-7 ─────────────────────────────────────────────────────────
// A variant of the Goldman–Parker construction: a generic triple of isotropic
// n-planes (x, y, z) in R^{n,n+1} (here n = 3, ambient R⁷). For a pair (x, y),
// R⁷ = x ⊕ (x⊥ ∩ y⊥) ⊕ y and the generator γ_{xy} = Id ⊕ −Id ⊕ −Id is an
// involution. The three γ's below generate the group; the entries are integral,
// so the group is discrete. Open question the limit set should help answer:
// free product ℤ/2 ∗ ℤ/2 ∗ ℤ/2, or a lattice?

const G1 = mat([
  [ 1,  0,  0, -4,  0,  0,  4],
  [ 0,  1,  0,  0, -4,  0,  0],
  [ 0,  0,  1,  0,  0, -4,  0],
  [ 0,  0,  0, -1,  0,  0,  0],
  [ 0,  0,  0,  0, -1,  0,  0],
  [ 0,  0,  0,  0,  0, -1,  0],
  [ 0,  0,  0,  0,  0,  0, -1],
]);

const G2 = mat([
  [ 1,  0,  0,  0,  0,  0,  0],
  [ 0,  1,  0,  0,  0,  0,  0],
  [ 0,  0,  1,  0,  0,  0,  0],
  [ 2,  0,  0, -1,  0,  0,  0],
  [ 0,  1,  0,  0, -1,  0,  0],
  [ 0,  0,  1,  0,  0, -1,  0],
  [ 1,  0,  0,  0,  0,  0, -1],
]);

const G3 = mat([
  [-1,  0,  0,  0,  0,  0,  0],
  [ 0, -1,  0,  0,  0,  0,  0],
  [ 0,  0, -1,  0,  0,  0,  0],
  [ 0,  0,  0, -1,  0,  0,  0],
  [ 0,  0,  0,  0,  1,  0,  0],
  [ 0,  0,  0,  0,  0,  1,  0],
  [ 0,  0,  0,  0,  0,  0,  1],
]);

export const EXAMPLES: readonly RP6Example[] = [
  {
    id: 'goldman-parker-7',
    label: 'Goldman–Parker triple (SL(7,ℤ))',
    description:
      'Three integer involutions ⟨g₁, g₂, g₃⟩ ⊂ SL(7,ℤ) from a Goldman–Parker ' +
      'variant (generic isotropic 3-planes in R^{3,4}). Discrete (integral); ' +
      'limit set in RP⁶ probes free-vs-lattice.',
    generators: [G1, G2, G3],
    involutions: true,
  },
];

export function exampleById(id: string): RP6Example {
  const ex = EXAMPLES.find((e) => e.id === id);
  if (!ex) throw new Error(`unknown rp6-triples example id: ${id}`);
  return ex;
}
