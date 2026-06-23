/**
 * Shared O(5) example type — the full degree-5 orthogonal hypergeometric atlas.
 *
 * One monodromy group Γ(f,g): a pair (α, β) of five rotation numbers, the
 * derived integer coefficient lists of f = ∏(x − e^{2πiαⱼ}) and
 * g = ∏(x − e^{2πiβⱼ}), the signature type of the invariant form, and the
 * thin/arithmetic/finite status with the paper that established it.
 *
 * Numbering follows the master classification of Bajpai–Singh, "On Orthogonal
 * Hypergeometric Groups of Degree Five" (arXiv:1706.08791): all 77 cases are
 * numbered 1–77. Concrete instances come from `catalog.ts`. The generators are
 * the companion matrices A = comp(f), B = comp(g); the group is ⟨T⟩ ∗ ⟨B⟩ with
 * T = B·A⁻¹ an involution (see `action.ts`); the limit-set basepoint is the
 * attracting point of a loxodromic word found by `seed.ts`.
 */

/** Signature of the invariant quadratic form. 'O(5)' = positive definite (the
 *  4 finite groups). */
export type O5Type = 'O(3,2)' | 'O(4,1)' | 'O(5)';

/** Classification status. 'finite' groups have no limit set (finite orbit). */
export type O5Status = 'thin' | 'arithmetic' | 'open' | 'finite';

export interface O5Example {
  id: string;
  label: string;
  /** Bajpai–Singh global numbering, 1–77. */
  bsNo: number;
  type: O5Type;
  status: O5Status;
  /** Paper that established the status (or '—' for open/finite). */
  source: string;
  /** Label in Bajpai–Nitsche "Thin Monodromy in O(5)" (e.g. "O(4,1) Case 3"),
   *  for the 29 groups that appear there; undefined otherwise. */
  bdnLabel?: string;
  /** True if B has infinite order (B = comp(g) has a repeated root). */
  bInfinite: boolean;
  alpha: readonly string[];
  beta: readonly string[];
  coefflistf: readonly number[];
  coefflistg: readonly number[];
}
