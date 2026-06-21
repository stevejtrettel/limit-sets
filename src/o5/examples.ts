/**
 * O(5) hypergeometric monodromy examples (Bajpai–Nitsche, "Thin Monodromy in
 * O(5)", Tables 1–4).
 *
 * Each group is a pair (α, β) of five rotation numbers in ℚ/ℤ; its generators
 * are the companion matrices A = comp(f), B = comp(g) of
 *   f(x) = ∏(x − e^{2πiαⱼ}),   g(x) = ∏(x − e^{2πiβⱼ}).
 * We store (α, β) as rotation-number strings and DERIVE the integer coefficient
 * lists via `hypergeometric.ts` (degree-agnostic, integer-snapped, conjugate-
 * closure checked) — no hand-typed coefficients.
 *
 * The group is the free product G = ⟨T⟩ ∗ ⟨B⟩ with T = B·A⁻¹ an involution, so
 * the orbit is walked over the {T, B} alphabet (see `action.ts`). The basepoint
 * is the attracting fixed point of a loxodromic word found by `seed.ts`.
 *
 * This is a CURATED starter list — one fully-worked case per geometry plus a
 * couple of siblings (including a finite-order-B case). The full Tables 1–4
 * catalog will live in `catalog.ts` once the pipeline is proven end-to-end.
 */

import { polynomialFromRotationStrings } from '../sp6/hypergeometric.ts';

export type O5Type = 'O(3,2)' | 'O(4,1)';

export interface O5Example {
  id: string;
  label: string;
  type: O5Type;
  nature: 'thin' | 'open';
  /** True if B has infinite order (annotated per case in the paper). */
  bInfinite: boolean;
  alpha: readonly string[];
  beta: readonly string[];
  coefflistf: readonly number[];
  coefflistg: readonly number[];
}

interface RowSpec {
  id: string;
  label: string;
  type: O5Type;
  nature?: 'thin' | 'open';
  bInfinite: boolean;
  alpha: readonly string[];
  beta: readonly string[];
}

function makeExample(r: RowSpec): O5Example {
  return {
    id: r.id,
    label: r.label,
    type: r.type,
    nature: r.nature ?? 'thin',
    bInfinite: r.bInfinite,
    alpha: r.alpha,
    beta: r.beta,
    coefflistf: polynomialFromRotationStrings(r.alpha),
    coefflistg: polynomialFromRotationStrings(r.beta),
  };
}

// ─── Curated starter list ────────────────────────────────────────────────────

export const EXAMPLES: readonly O5Example[] = [
  // Type O(4,1) — real rank one (hyperbolic); limit set on a 3-sphere in RP⁴.
  makeExample({
    id: 'r1-1', label: 'O(4,1) Case 1', type: 'O(4,1)', bInfinite: true,
    alpha: ['0', '0', '0', '1/3', '2/3'], beta: ['1/2', '1/2', '1/2', '1/4', '3/4'],
  }),
  makeExample({
    id: 'r1-3', label: 'O(4,1) Case 3', type: 'O(4,1)', bInfinite: false,
    alpha: ['0', '0', '0', '1/3', '2/3'], beta: ['1/2', '1/5', '2/5', '3/5', '4/5'],
  }),
  makeExample({
    id: 'r1-4', label: 'O(4,1) Case 4', type: 'O(4,1)', bInfinite: false,
    alpha: ['0', '0', '0', '1/4', '3/4'], beta: ['1/2', '1/3', '2/3', '1/6', '5/6'],
  }),
  // Type O(3,2) — real rank two.
  makeExample({
    id: 'r2-1', label: 'O(3,2) Case 1', type: 'O(3,2)', bInfinite: true,
    alpha: ['0', '0', '0', '0', '0'], beta: ['1/2', '1/2', '1/2', '1/2', '1/2'],
  }),
  makeExample({
    id: 'r2-7', label: 'O(3,2) Case 7 (sextic)', type: 'O(3,2)', bInfinite: true,
    alpha: ['0', '0', '0', '0', '0'], beta: ['1/2', '1/3', '2/3', '1/6', '5/6'],
  }),
];

export function exampleById(id: string): O5Example {
  const ex = EXAMPLES.find((e) => e.id === id);
  if (!ex) throw new Error(`unknown o5 example id: ${id}`);
  return ex;
}
