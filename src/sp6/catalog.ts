/**
 * The Bajpai–Doña–Nitsche catalog of Sp(6) hypergeometric "companion matrix"
 * groups — the data behind the sp6-explorer demo.
 *
 * Source: J. Bajpai, D. Doña, M. Nitsche, "Thin monodromy in Sp(4) and Sp(6)"
 * (arXiv:2112.12111v3), Tables 1 and 2. Each group is a pair of hypergeometric
 * parameter tuples (α, β) of rotation numbers in ℚ/ℤ; its two generators are the
 * companion matrices of  f(x) = ∏(x − e^{2πiαⱼ})  and  g(x) = ∏(x − e^{2πiβⱼ}).
 * We store (α, β, nature) and DERIVE the integer polynomials via
 * `hypergeometric.ts` (one round-trip, integer-snapped, conjugate-closure
 * checked) rather than hand-typing coefficient lists.
 *
 *   Table 1 — 40 "maximally unipotent" groups A-1…A-40, all with
 *             α = (0,0,0,0,0,0) (so f = (x−1)⁶). 17 thin, 23 arithmetic
 *             (Corollary 3). The thin ones are A-1…A-14, A-31, A-37, A-38.
 *   Table 2 — 46 more groups C-2…C-58 (gaps in the numbering match [3, Table C]),
 *             with α ≠ 0; ALL thin (Theorem 4).
 *   Table 3 — 3 open cases C-32, C-47, C-55 (α ≠ 0) whose thinness/arithmeticity
 *             is unknown; carried with nature 'open'.
 *
 * The degree-4 Sp(4) family (Table 4) is excluded — it needs a degree-4
 * companion action, not the degree-6 makeSp6Action this catalog targets.
 *
 * This is a NEW dataset, independent of `examples.ts` (which the existing
 * sp6-limit-sets / c32 demos use and which we leave untouched — note its A-15
 * row predates this catalog and uses a different β).
 */

import type { ExampleGroup } from './examples.ts';
import { polynomialFromRotationStrings } from './hypergeometric.ts';

export interface CatalogRow {
  /** Paper label, e.g. 'A-1', 'C-32'. */
  label: string;
  /** Which table it came from (1 = maximally unipotent, 2 = more thin, 3 = open). */
  table: 1 | 2 | 3;
  nature: 'thin' | 'arithmetic' | 'open';
  /** Six rotation numbers as compact strings ('0', '1/2', '5/12', …). */
  alpha: readonly string[];
  beta: readonly string[];
}

// α is the all-zeros tuple for every Table-1 row (maximally unipotent).
const ZERO6: readonly string[] = ['0', '0', '0', '0', '0', '0'];

// ─── Table 1 — maximally unipotent Sp(6) groups (A-1…A-40) ───────────────────
// α = (0,0,0,0,0,0) for all; only β varies. Thin: A-1…A-14, A-31, A-37, A-38.

const TABLE1: readonly CatalogRow[] = [
  { label: 'A-1',  table: 1, nature: 'thin',       alpha: ZERO6, beta: ['1/2','1/2','1/2','1/2','1/2','1/2'] },
  { label: 'A-2',  table: 1, nature: 'thin',       alpha: ZERO6, beta: ['1/2','1/2','1/2','1/2','1/3','2/3'] },
  { label: 'A-3',  table: 1, nature: 'thin',       alpha: ZERO6, beta: ['1/2','1/2','1/2','1/2','1/4','3/4'] },
  { label: 'A-4',  table: 1, nature: 'thin',       alpha: ZERO6, beta: ['1/2','1/2','1/2','1/2','1/6','5/6'] },
  { label: 'A-5',  table: 1, nature: 'thin',       alpha: ZERO6, beta: ['1/2','1/2','1/3','1/3','2/3','2/3'] },
  { label: 'A-6',  table: 1, nature: 'thin',       alpha: ZERO6, beta: ['1/2','1/2','1/3','2/3','1/4','3/4'] },
  { label: 'A-7',  table: 1, nature: 'thin',       alpha: ZERO6, beta: ['1/2','1/2','1/3','2/3','1/6','5/6'] },
  { label: 'A-8',  table: 1, nature: 'thin',       alpha: ZERO6, beta: ['1/2','1/2','1/4','1/4','3/4','3/4'] },
  { label: 'A-9',  table: 1, nature: 'thin',       alpha: ZERO6, beta: ['1/2','1/2','1/4','3/4','1/6','5/6'] },
  { label: 'A-10', table: 1, nature: 'thin',       alpha: ZERO6, beta: ['1/2','1/2','1/5','2/5','3/5','4/5'] },
  { label: 'A-11', table: 1, nature: 'thin',       alpha: ZERO6, beta: ['1/2','1/2','1/6','1/6','5/6','5/6'] },
  { label: 'A-12', table: 1, nature: 'thin',       alpha: ZERO6, beta: ['1/2','1/2','1/8','3/8','5/8','7/8'] },
  { label: 'A-13', table: 1, nature: 'thin',       alpha: ZERO6, beta: ['1/2','1/2','1/10','3/10','7/10','9/10'] },
  { label: 'A-14', table: 1, nature: 'thin',       alpha: ZERO6, beta: ['1/2','1/2','1/12','5/12','7/12','11/12'] },
  { label: 'A-15', table: 1, nature: 'arithmetic', alpha: ZERO6, beta: ['1/3','1/3','1/3','2/3','2/3','2/3'] },
  { label: 'A-16', table: 1, nature: 'arithmetic', alpha: ZERO6, beta: ['1/3','1/3','2/3','2/3','1/4','3/4'] },
  { label: 'A-17', table: 1, nature: 'arithmetic', alpha: ZERO6, beta: ['1/3','1/3','2/3','2/3','1/6','5/6'] },
  { label: 'A-18', table: 1, nature: 'arithmetic', alpha: ZERO6, beta: ['1/3','2/3','1/4','1/4','3/4','3/4'] },
  { label: 'A-19', table: 1, nature: 'arithmetic', alpha: ZERO6, beta: ['1/3','2/3','1/4','3/4','1/6','5/6'] },
  { label: 'A-20', table: 1, nature: 'arithmetic', alpha: ZERO6, beta: ['1/3','2/3','1/6','5/6','1/6','5/6'] },
  { label: 'A-21', table: 1, nature: 'arithmetic', alpha: ZERO6, beta: ['1/3','2/3','1/5','2/5','3/5','4/5'] },
  { label: 'A-22', table: 1, nature: 'arithmetic', alpha: ZERO6, beta: ['1/3','2/3','1/8','3/8','5/8','7/8'] },
  { label: 'A-23', table: 1, nature: 'arithmetic', alpha: ZERO6, beta: ['1/3','2/3','1/10','3/10','7/10','9/10'] },
  { label: 'A-24', table: 1, nature: 'arithmetic', alpha: ZERO6, beta: ['1/3','2/3','1/12','5/12','7/12','11/12'] },
  { label: 'A-25', table: 1, nature: 'arithmetic', alpha: ZERO6, beta: ['1/4','1/4','1/4','3/4','3/4','3/4'] },
  { label: 'A-26', table: 1, nature: 'arithmetic', alpha: ZERO6, beta: ['1/4','1/4','3/4','3/4','1/6','5/6'] },
  { label: 'A-27', table: 1, nature: 'arithmetic', alpha: ZERO6, beta: ['1/4','3/4','1/5','2/5','3/5','4/5'] },
  { label: 'A-28', table: 1, nature: 'arithmetic', alpha: ZERO6, beta: ['1/4','3/4','1/6','5/6','1/6','5/6'] },
  { label: 'A-29', table: 1, nature: 'arithmetic', alpha: ZERO6, beta: ['1/4','3/4','1/8','3/8','5/8','7/8'] },
  { label: 'A-30', table: 1, nature: 'arithmetic', alpha: ZERO6, beta: ['1/4','3/4','1/10','3/10','7/10','9/10'] },
  { label: 'A-31', table: 1, nature: 'thin',       alpha: ZERO6, beta: ['1/4','3/4','1/12','5/12','7/12','11/12'] },
  { label: 'A-32', table: 1, nature: 'arithmetic', alpha: ZERO6, beta: ['1/5','2/5','3/5','4/5','1/6','5/6'] },
  { label: 'A-33', table: 1, nature: 'arithmetic', alpha: ZERO6, beta: ['1/6','5/6','1/6','5/6','1/6','5/6'] },
  { label: 'A-34', table: 1, nature: 'arithmetic', alpha: ZERO6, beta: ['1/6','5/6','1/8','3/8','5/8','7/8'] },
  { label: 'A-35', table: 1, nature: 'arithmetic', alpha: ZERO6, beta: ['1/6','5/6','1/10','3/10','7/10','9/10'] },
  { label: 'A-36', table: 1, nature: 'arithmetic', alpha: ZERO6, beta: ['1/6','5/6','1/12','5/12','7/12','11/12'] },
  { label: 'A-37', table: 1, nature: 'thin',       alpha: ZERO6, beta: ['1/7','2/7','3/7','4/7','5/7','6/7'] },
  { label: 'A-38', table: 1, nature: 'thin',       alpha: ZERO6, beta: ['1/9','2/9','4/9','5/9','7/9','8/9'] },
  { label: 'A-39', table: 1, nature: 'arithmetic', alpha: ZERO6, beta: ['1/14','3/14','5/14','9/14','11/14','13/14'] },
  { label: 'A-40', table: 1, nature: 'arithmetic', alpha: ZERO6, beta: ['1/18','5/18','7/18','11/18','13/18','17/18'] },
];

// ─── Table 2 — more thin Sp(6) groups (C-…) ──────────────────────────────────
// All thin (Theorem 4). Transcribed from the LaTeX source (Sep22.tex), parsed
// and cross-checked. 46 rows in the paper; we carry 45 — C-15 is omitted because
// its printed β is a typo (see C15_TYPO below). Numbering gaps (C-9/10, C-29…32,
// C-39, C-42, C-47, C-51, C-55, …) match the paper / [3, Table C].

const TABLE2: readonly CatalogRow[] = [
  { label: 'C-2',      table: 2, nature: 'thin', alpha: ['0','0','0','0','1/3','2/3'], beta: ['1/2','1/2','1/2','1/2','1/4','3/4'] },
  { label: 'C-3',      table: 2, nature: 'thin', alpha: ['0','0','0','0','1/3','2/3'], beta: ['1/2','1/2','1/2','1/2','1/6','5/6'] },
  { label: 'C-4',      table: 2, nature: 'thin', alpha: ['0','0','0','0','1/3','2/3'], beta: ['1/2','1/2','1/4','1/4','3/4','3/4'] },
  { label: 'C-5',      table: 2, nature: 'thin', alpha: ['0','0','0','0','1/3','2/3'], beta: ['1/2','1/2','1/5','2/5','3/5','4/5'] },
  { label: 'C-6',      table: 2, nature: 'thin', alpha: ['0','0','0','0','1/3','2/3'], beta: ['1/2','1/2','1/8','3/8','5/8','7/8'] },
  { label: 'C-7',      table: 2, nature: 'thin', alpha: ['0','0','0','0','1/3','2/3'], beta: ['1/2','1/2','1/10','3/10','7/10','9/10'] },
  { label: 'C-8',      table: 2, nature: 'thin', alpha: ['0','0','0','0','1/3','2/3'], beta: ['1/2','1/2','1/12','5/12','7/12','11/12'] },
  { label: 'C-11',     table: 2, nature: 'thin', alpha: ['0','0','0','0','1/4','3/4'], beta: ['1/2','1/2','1/2','1/2','1/3','2/3'] },
  { label: 'C-12',     table: 2, nature: 'thin', alpha: ['0','0','0','0','1/4','3/4'], beta: ['1/2','1/2','1/3','1/3','2/3','2/3'] },
  { label: 'C-13',     table: 2, nature: 'thin', alpha: ['0','0','0','0','1/4','3/4'], beta: ['1/2','1/2','1/3','2/3','1/6','5/6'] },
  { label: 'C-14',     table: 2, nature: 'thin', alpha: ['0','0','0','0','1/4','3/4'], beta: ['1/2','1/2','1/5','2/5','3/5','4/5'] },
  // C-15 OMITTED — paper's β = (1/2,1/2,1/6,5/6,5/6,5/6) is not conjugate-closed
  // (1/6 once, 5/6 thrice) ⇒ no real polynomial. Suspected typo for A-11's β
  // (1/2,1/2,1/6,1/6,5/6,5/6). See C15_TYPO; restore once confirmed.
  { label: 'C-16',     table: 2, nature: 'thin', alpha: ['0','0','0','0','1/4','3/4'], beta: ['1/2','1/2','1/8','3/8','5/8','7/8'] },
  { label: 'C-17',     table: 2, nature: 'thin', alpha: ['0','0','0','0','1/4','3/4'], beta: ['1/2','1/2','1/10','3/10','7/10','9/10'] },
  { label: 'C-18',     table: 2, nature: 'thin', alpha: ['0','0','0','0','1/4','3/4'], beta: ['1/2','1/2','1/12','5/12','7/12','11/12'] },
  { label: 'C-19',     table: 2, nature: 'thin', alpha: ['0','0','0','0','1/4','3/4'], beta: ['1/7','2/7','3/7','4/7','5/7','6/7'] },
  { label: 'C-20',     table: 2, nature: 'thin', alpha: ['0','0','0','0','1/4','3/4'], beta: ['1/9','2/9','4/9','5/9','7/9','8/9'] },
  { label: 'C-21',     table: 2, nature: 'thin', alpha: ['0','0','0','0','1/6','5/6'], beta: ['1/2','1/2','1/2','1/2','1/3','2/3'] },
  { label: 'C-22',     table: 2, nature: 'thin', alpha: ['0','0','0','0','1/6','5/6'], beta: ['1/2','1/2','1/3','1/3','2/3','2/3'] },
  { label: 'C-23',     table: 2, nature: 'thin', alpha: ['0','0','0','0','1/6','5/6'], beta: ['1/2','1/2','1/3','2/3','1/4','3/4'] },
  { label: 'C-24',     table: 2, nature: 'thin', alpha: ['0','0','0','0','1/6','5/6'], beta: ['1/2','1/2','1/4','1/4','3/4','3/4'] },
  { label: 'C-25',     table: 2, nature: 'thin', alpha: ['0','0','0','0','1/6','5/6'], beta: ['1/2','1/2','1/5','2/5','3/5','4/5'] },
  { label: 'C-26',     table: 2, nature: 'thin', alpha: ['0','0','0','0','1/6','5/6'], beta: ['1/2','1/2','1/8','3/8','5/8','7/8'] },
  { label: 'C-27',     table: 2, nature: 'thin', alpha: ['0','0','0','0','1/6','5/6'], beta: ['1/2','1/2','1/10','3/10','7/10','9/10'] },
  { label: 'C-28',     table: 2, nature: 'thin', alpha: ['0','0','0','0','1/6','5/6'], beta: ['1/2','1/2','1/12','5/12','7/12','11/12'] },
  { label: 'C-33',     table: 2, nature: 'thin', alpha: ['0','0','0','0','1/6','5/6'], beta: ['1/7','2/7','3/7','4/7','5/7','6/7'] },
  { label: 'C-34',     table: 2, nature: 'thin', alpha: ['0','0','0','0','1/6','5/6'], beta: ['1/9','2/9','4/9','5/9','7/9','8/9'] },
  { label: 'C-35',     table: 2, nature: 'thin', alpha: ['0','0','1/3','2/3','1/4','3/4'], beta: ['1/2','1/2','1/5','2/5','3/5','4/5'] },
  { label: 'C-36',     table: 2, nature: 'thin', alpha: ['0','0','1/3','2/3','1/6','5/6'], beta: ['1/2','1/2','1/4','1/4','3/4','3/4'] },
  { label: 'C-37',     table: 2, nature: 'thin', alpha: ['0','0','1/3','2/3','1/6','5/6'], beta: ['1/2','1/2','1/5','2/5','3/5','4/5'] },
  { label: 'C-38',     table: 2, nature: 'thin', alpha: ['0','0','1/3','2/3','1/6','5/6'], beta: ['1/2','1/2','1/8','3/8','5/8','7/8'] },
  { label: 'C-40',     table: 2, nature: 'thin', alpha: ['0','0','1/4','1/4','3/4','3/4'], beta: ['1/2','1/2','1/3','2/3','1/3','2/3'] },
  { label: 'C-41',     table: 2, nature: 'thin', alpha: ['0','0','1/4','1/4','3/4','3/4'], beta: ['1/2','1/2','1/5','2/5','3/5','4/5'] },
  { label: 'C-43',     table: 2, nature: 'thin', alpha: ['0','0','1/4','3/4','1/6','5/6'], beta: ['1/2','1/2','1/3','1/3','2/3','2/3'] },
  { label: 'C-44',     table: 2, nature: 'thin', alpha: ['0','0','1/4','3/4','1/6','5/6'], beta: ['1/2','1/2','1/5','2/5','3/5','4/5'] },
  { label: 'C-45',     table: 2, nature: 'thin', alpha: ['0','0','1/4','3/4','1/6','5/6'], beta: ['1/2','1/2','1/8','3/8','5/8','7/8'] },
  { label: 'C-46',     table: 2, nature: 'thin', alpha: ['0','0','1/4','3/4','1/6','5/6'], beta: ['1/7','2/7','3/7','4/7','5/7','6/7'] },
  { label: 'C-48',     table: 2, nature: 'thin', alpha: ['0','0','1/6','1/6','5/6','5/6'], beta: ['1/2','1/2','1/3','1/3','2/3','2/3'] },
  { label: 'C-49',     table: 2, nature: 'thin', alpha: ['0','0','1/6','1/6','5/6','5/6'], beta: ['1/2','1/2','1/5','2/5','3/5','4/5'] },
  { label: 'C-50',     table: 2, nature: 'thin', alpha: ['0','0','1/6','1/6','5/6','5/6'], beta: ['1/2','1/2','1/8','3/8','5/8','7/8'] },
  { label: 'C-52',     table: 2, nature: 'thin', alpha: ['0','0','1/6','1/6','5/6','5/6'], beta: ['1/7','2/7','3/7','4/7','5/7','6/7'] },
  { label: 'C-53',     table: 2, nature: 'thin', alpha: ['0','0','1/6','1/6','5/6','5/6'], beta: ['1/9','2/9','4/9','5/9','7/9','8/9'] },
  { label: 'C-54',     table: 2, nature: 'thin', alpha: ['0','0','1/8','3/8','5/8','7/8'], beta: ['1/2','1/2','1/5','2/5','3/5','4/5'] },
  { label: 'C-56',     table: 2, nature: 'thin', alpha: ['0','0','1/10','3/10','7/10','9/10'], beta: ['1/2','1/2','1/5','2/5','3/5','4/5'] },
  { label: 'C-57',     table: 2, nature: 'thin', alpha: ['0','0','1/10','3/10','7/10','9/10'], beta: ['1/2','1/2','1/12','5/12','7/12','11/12'] },
  { label: 'C-58',     table: 2, nature: 'thin', alpha: ['0','0','1/10','3/10','7/10','9/10'], beta: ['1/7','2/7','3/7','4/7','5/7','6/7'] },
];

/**
 * C-15 anomaly. The paper (Table 2, and its LaTeX source) prints
 *   C-15: α = (0,0,0,0,1/4,3/4),  β = (1/2,1/2,1/6,5/6,5/6,5/6).
 * That β has 1/6 once and 5/6 three times, so it is NOT closed under negation
 * mod 1 — ∏(x − e^{2πiβⱼ}) is not a real polynomial and there is no companion
 * matrix in SL₆(ℤ). It sits between C-14 (= A-10's β) and C-16 (= A-12's β); by
 * that pattern the intended β is A-11's, (1/2,1/2,1/6,1/6,5/6,5/6) — a single
 * digit fix (4th entry 5/6 → 1/6). Pending confirmation we OMIT C-15; flip
 * `applyCorrection` to true (or edit the row above) to include the corrected group.
 */
export const C15_TYPO = {
  label: 'C-15',
  printedBeta: ['1/2', '1/2', '1/6', '5/6', '5/6', '5/6'],
  suspectedBeta: ['1/2', '1/2', '1/6', '1/6', '5/6', '5/6'],
} as const;

// ─── Table 3 — open cases (arithmeticity/thinness unknown) ───────────────────
// All α ≠ 0. Drawable like any other group; their classification is just open.
// (C-32 has since been shown thin in a separate note, but the paper lists it here.)
const TABLE3: readonly CatalogRow[] = [
  { label: 'C-32',     table: 3, nature: 'open', alpha: ['0','0','0','0','1/6','5/6'], beta: ['1/4','3/4','1/12','5/12','7/12','11/12'] },
  { label: 'C-47',     table: 3, nature: 'open', alpha: ['0','0','1/5','2/5','3/5','4/5'], beta: ['1/2','1/2','1/3','1/3','2/3','2/3'] },
  { label: 'C-55',     table: 3, nature: 'open', alpha: ['0','0','1/8','3/8','5/8','7/8'], beta: ['1/2','1/2','1/12','5/12','7/12','11/12'] },
];

/** The full catalog (Table 1, then Table 2, then Table 3 open cases), in paper order. */
export const CATALOG: readonly CatalogRow[] = [...TABLE1, ...TABLE2, ...TABLE3];

// ─── Row → ExampleGroup ──────────────────────────────────────────────────────

/** TBT (= A⁻¹·B·B·A⁻¹·B) in the action's generator codes (0=A,1=A⁻¹,2=B,3=B⁻¹).
 *  Loxodromic for every group in the family — the proximal basepoint comes from
 *  power-iterating it. */
const TBT: readonly number[] = [1, 2, 2, 1, 2];

const display = (rots: readonly string[]): string => `(${rots.join(', ')})`;
const idFromLabel = (label: string): string => label.replace(/-/g, '');

/** Derive the full `ExampleGroup` (companion-matrix data + display strings) from
 *  a catalog row. Throws (via `polynomialFromRotationStrings`) if α or β is not
 *  conjugate-closed — i.e. a transcription error that yields a non-integer poly. */
export function rowToExample(row: CatalogRow): ExampleGroup {
  return {
    id: idFromLabel(row.label),
    label: row.label,
    nature: row.nature,
    coefflistf: polynomialFromRotationStrings(row.alpha),
    coefflistg: polynomialFromRotationStrings(row.beta),
    gamma: TBT,
    gammaName: 'TBT',
    powerIter: 30,
    alpha: display(row.alpha),
    beta: display(row.beta),
  };
}

/** The catalog as ready-to-use `ExampleGroup`s. */
export const CATALOG_EXAMPLES: readonly ExampleGroup[] = CATALOG.map(rowToExample);
