/**
 * Curated SU(2,1) examples on ∂CH² = S³.
 *
 * Two kinds of row, both pure data:
 *   - `cartanA` — an IDEAL TRIANGLE GROUP: three boundary points with Cartan
 *     angular invariant A (via `idealTrianglePoints`), generators the three
 *     complex reflections in the pairwise complex geodesics. A = 0 is the
 *     R-Fuchsian triangle group (limit set = an R-circle); nonzero A bends the
 *     limit set out of every real plane. This is the family the Goldman–Parker
 *     catalog will extend (discreteness holds up to the Schwartz threshold
 *     where ι₁ι₂ι₃ turns elliptic).
 *   - `generators` — an explicit SU(2,1) alphabet (mixed involution/free).
 *
 * Starter rows double as correctness witnesses, pinned by
 * scripts/tests/su21-gates.ts: the A = 0 orbit must lie on the standard
 * R-circle, the C-Fuchsian orbit on the C-circle {w₂ = 0}.
 */

import type { GroupAction } from '../../core/group.ts';
import type { CGen } from '../../core/complexMatrixAction.ts';
import { cmat } from '../../core/complexMatrix.ts';
import type { CVec3 } from './hermitian.ts';
import { idealTrianglePoints, idealTriangleAction, su21Action, seedCH2 } from './recipe.ts';
import type { Seed } from '../../core/seed.ts';

export interface SU21Example {
  id: string;
  label: string;
  /** Short human-readable description of the group's nature. */
  description: string;
  /** Ideal triangle group, normalized triple with this Cartan angular
   *  invariant A ∈ (−π/2, π/2) (via `idealTrianglePoints`). */
  cartanA?: number;
  /** Ideal triangle group on an EXPLICIT boundary triple (null vectors,
   *  authored with `cvec3`). Same construction, your own points. */
  points?: readonly [CVec3, CVec3, CVec3];
  /** Or an explicit generating set (mixed involution / free alphabet). */
  generators?: readonly CGen[];
  /** Generator-code labels for seed-word display (defaults to ι₁ι₂ι₃…). */
  labels?: readonly string[];
}

/** Resolve a row's ideal-triangle points (null for `generators` rows). */
export function trianglePointsOf(ex: SU21Example): [CVec3, CVec3, CVec3] | null {
  if (ex.points) return [ex.points[0], ex.points[1], ex.points[2]];
  return ex.cartanA !== undefined ? idealTrianglePoints(ex.cartanA) : null;
}

/** Build the row's GroupAction (the one place all row kinds converge). */
export function buildAction(ex: SU21Example): GroupAction {
  const pts = trianglePointsOf(ex);
  if (pts) return idealTriangleAction(pts[0], pts[1], pts[2]);
  if (ex.generators) return su21Action(ex.generators);
  throw new Error(`example '${ex.id}' has no cartanA, points, or generators`);
}

/** Seed on the limit set (shortest certified loxodromic word). */
export function seedSU21(ex: SU21Example, action: GroupAction): Seed {
  return seedCH2(action, ex.labels);
}

// ─── C-Fuchsian witness: Sanov's free group in SU(1,1) ⊂ SU(2,1) ───────────
//
// The classical free group ⟨[[1,2],[0,1]], [[1,0],[2,1]]⟩ ⊂ SL(2,R),
// conjugated to the disk model (SU(1,1)) and embedded in the (z₁, z₃) block
// with z₂ fixed. The limit set is a Cantor subset of the C-CIRCLE {w₂ = 0} —
// the boundary of the complex geodesic z₂ = 0 — because the z₂ direction is
// preserved outright. Both generators are parabolic; ab is loxodromic
// (tr = 6 upstairs), so the seed search lands on a length-2 word.
const cFuchsianGens: readonly CGen[] = [
  // a = disk-model [[1+i, −i], [i, 1−i]]
  { M: cmat([
    [[1,  1], [0, 0], [0, -1]],
    [[0,  0], [1, 0], [0,  0]],
    [[0,  1], [0, 0], [1, -1]],
  ]) },
  // b = disk-model [[1−i, −i], [i, 1+i]]
  { M: cmat([
    [[1, -1], [0, 0], [0, -1]],
    [[0,  0], [1, 0], [0,  0]],
    [[0,  1], [0, 0], [1,  1]],
  ]) },
];

export const EXAMPLES: readonly SU21Example[] = [
  {
    id: 'ideal-triangle-fuchsian',
    label: 'Ideal triangle, A = 0 (R-Fuchsian)',
    description: 'real ideal triangle group; limit set = the standard R-circle in S³',
    cartanA: 0,
  },
  {
    id: 'ideal-triangle-A45',
    label: 'Ideal triangle, A = π/4',
    description: 'bent ideal triangle group; limit set leaves every real plane (genuinely 3D curve)',
    cartanA: Math.PI / 4,
  },
  {
    id: 'c-fuchsian',
    label: 'C-Fuchsian Schottky (Sanov in SU(1,1))',
    description: 'free group preserving a complex geodesic; limit set = Cantor subset of the C-circle {w₂ = 0}',
    generators: cFuchsianGens,
    labels: ['a', 'a⁻¹', 'b', 'b⁻¹'],
  },
];

export function exampleById(id: string): SU21Example {
  const ex = EXAMPLES.find((e) => e.id === id);
  if (!ex) throw new Error(`unknown su21 example id: ${id}`);
  return ex;
}
