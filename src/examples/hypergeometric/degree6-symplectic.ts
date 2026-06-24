/**
 * The Bajpai–Doña–Nitsche degree-6 symplectic hypergeometric tables — the data
 * behind the sp6-explorer demo, plus a small curated subset (with reference
 * |λ_max| values) used by the sp6-limit-sets and c32 demos.
 *
 * Source: J. Bajpai, D. Doña, M. Nitsche, "Thin monodromy in Sp(4) and Sp(6)"
 * (arXiv:2112.12111v3), Tables 1–3. Each group is a pair of rotation tuples
 * (α, β) of rotation numbers in ℚ/ℤ; its generators are the companion matrices
 * of f = ∏(x − e^{2πiαⱼ}) and g = ∏(x − e^{2πiβⱼ}) — built by the shared
 * hypergeometric recipe (./recipe.ts). This catalog walks the free group
 * {A, A⁻¹, B, B⁻¹} (T = A⁻¹B is a unipotent transvection, not an involution, so
 * no free-product reduction applies).
 *
 *   Table 1 — 40 maximally-unipotent groups A-1…A-40 (α = 0). 17 thin, 23 arith.
 *   Table 2 — 45 more thin C-groups (C-15 omitted; see C15_TYPO).
 *   Table 3 — 3 open cases C-32, C-47, C-55.
 *
 * (Merges the old sp6/catalog.ts and sp6/examples.ts.)
 */

import { hypergeometricAction, WALK_LABELS, type Walk } from './recipe.ts';
import { seedFromLoxodromic, type Seed } from '../../core/seed.ts';
import type { GroupAction } from '../../core/group.ts';

/** This family's natural generating set. */
export const SYMPLECTIC_DEGREE6_WALK: Walk = 'free';

export interface SymplecticExample {
  id: string;
  label: string;
  status: 'thin' | 'arithmetic' | 'open';
  /** Rotation tuples (parseable, e.g. '1/2', '5/12'); the companion matrices of
   *  ∏(x − e^{2πiαⱼ}), ∏(x − e^{2πiβⱼ}) are derived on demand by the recipe. */
  alpha: readonly string[];
  beta: readonly string[];
  /** Optional human note (featured entries). */
  caption?: string;
}

/** The GroupAction for a symplectic example — companion pair from its rotation
 *  tuples, walked over the free group {A,A⁻¹,B,B⁻¹}. */
export function symplecticAction(ex: SymplecticExample): GroupAction {
  return hypergeometricAction(ex.alpha, ex.beta, SYMPLECTIC_DEGREE6_WALK);
}

/** TBT, the family's historically-known loxodromic word, kept only as the
 *  auto-search fallback (every thin/arithmetic symplectic group has a shorter
 *  certified loxodromic, so the fallback is essentially never hit). */
const SYMPLECTIC_FALLBACK: readonly number[] = [1, 2, 2, 1, 2];

/** Limit-set basepoint for a symplectic group: the attracting fixed point of the
 *  shortest CERTIFIED loxodromic word (Phase-7 uniform auto-seeding), found by
 *  the group-agnostic loxodromic search. Replaces the old fixed-TBT seeding. */
export function seedSymplectic(action: GroupAction): Seed {
  return seedFromLoxodromic(action, {
    labels: WALK_LABELS[SYMPLECTIC_DEGREE6_WALK],
    fallbackWord: SYMPLECTIC_FALLBACK,
  });
}

// ─── Catalog rows (α, β) → derived examples ─────────────────────────────────

interface CatalogRow {
  label: string;
  table: 1 | 2 | 3;
  status: 'thin' | 'arithmetic' | 'open';
  alpha: readonly string[];
  beta: readonly string[];
}

const ZERO6: readonly string[] = ['0', '0', '0', '0', '0', '0'];

// Table 1 — maximally unipotent (α = 0). Thin: A-1…A-14, A-31, A-37, A-38.
const TABLE1: readonly CatalogRow[] = [
  { label: 'A-1',  table: 1, status: 'thin',       alpha: ZERO6, beta: ['1/2','1/2','1/2','1/2','1/2','1/2'] },
  { label: 'A-2',  table: 1, status: 'thin',       alpha: ZERO6, beta: ['1/2','1/2','1/2','1/2','1/3','2/3'] },
  { label: 'A-3',  table: 1, status: 'thin',       alpha: ZERO6, beta: ['1/2','1/2','1/2','1/2','1/4','3/4'] },
  { label: 'A-4',  table: 1, status: 'thin',       alpha: ZERO6, beta: ['1/2','1/2','1/2','1/2','1/6','5/6'] },
  { label: 'A-5',  table: 1, status: 'thin',       alpha: ZERO6, beta: ['1/2','1/2','1/3','1/3','2/3','2/3'] },
  { label: 'A-6',  table: 1, status: 'thin',       alpha: ZERO6, beta: ['1/2','1/2','1/3','2/3','1/4','3/4'] },
  { label: 'A-7',  table: 1, status: 'thin',       alpha: ZERO6, beta: ['1/2','1/2','1/3','2/3','1/6','5/6'] },
  { label: 'A-8',  table: 1, status: 'thin',       alpha: ZERO6, beta: ['1/2','1/2','1/4','1/4','3/4','3/4'] },
  { label: 'A-9',  table: 1, status: 'thin',       alpha: ZERO6, beta: ['1/2','1/2','1/4','3/4','1/6','5/6'] },
  { label: 'A-10', table: 1, status: 'thin',       alpha: ZERO6, beta: ['1/2','1/2','1/5','2/5','3/5','4/5'] },
  { label: 'A-11', table: 1, status: 'thin',       alpha: ZERO6, beta: ['1/2','1/2','1/6','1/6','5/6','5/6'] },
  { label: 'A-12', table: 1, status: 'thin',       alpha: ZERO6, beta: ['1/2','1/2','1/8','3/8','5/8','7/8'] },
  { label: 'A-13', table: 1, status: 'thin',       alpha: ZERO6, beta: ['1/2','1/2','1/10','3/10','7/10','9/10'] },
  { label: 'A-14', table: 1, status: 'thin',       alpha: ZERO6, beta: ['1/2','1/2','1/12','5/12','7/12','11/12'] },
  { label: 'A-15', table: 1, status: 'arithmetic', alpha: ZERO6, beta: ['1/3','1/3','1/3','2/3','2/3','2/3'] },
  { label: 'A-16', table: 1, status: 'arithmetic', alpha: ZERO6, beta: ['1/3','1/3','2/3','2/3','1/4','3/4'] },
  { label: 'A-17', table: 1, status: 'arithmetic', alpha: ZERO6, beta: ['1/3','1/3','2/3','2/3','1/6','5/6'] },
  { label: 'A-18', table: 1, status: 'arithmetic', alpha: ZERO6, beta: ['1/3','2/3','1/4','1/4','3/4','3/4'] },
  { label: 'A-19', table: 1, status: 'arithmetic', alpha: ZERO6, beta: ['1/3','2/3','1/4','3/4','1/6','5/6'] },
  { label: 'A-20', table: 1, status: 'arithmetic', alpha: ZERO6, beta: ['1/3','2/3','1/6','5/6','1/6','5/6'] },
  { label: 'A-21', table: 1, status: 'arithmetic', alpha: ZERO6, beta: ['1/3','2/3','1/5','2/5','3/5','4/5'] },
  { label: 'A-22', table: 1, status: 'arithmetic', alpha: ZERO6, beta: ['1/3','2/3','1/8','3/8','5/8','7/8'] },
  { label: 'A-23', table: 1, status: 'arithmetic', alpha: ZERO6, beta: ['1/3','2/3','1/10','3/10','7/10','9/10'] },
  { label: 'A-24', table: 1, status: 'arithmetic', alpha: ZERO6, beta: ['1/3','2/3','1/12','5/12','7/12','11/12'] },
  { label: 'A-25', table: 1, status: 'arithmetic', alpha: ZERO6, beta: ['1/4','1/4','1/4','3/4','3/4','3/4'] },
  { label: 'A-26', table: 1, status: 'arithmetic', alpha: ZERO6, beta: ['1/4','1/4','3/4','3/4','1/6','5/6'] },
  { label: 'A-27', table: 1, status: 'arithmetic', alpha: ZERO6, beta: ['1/4','3/4','1/5','2/5','3/5','4/5'] },
  { label: 'A-28', table: 1, status: 'arithmetic', alpha: ZERO6, beta: ['1/4','3/4','1/6','5/6','1/6','5/6'] },
  { label: 'A-29', table: 1, status: 'arithmetic', alpha: ZERO6, beta: ['1/4','3/4','1/8','3/8','5/8','7/8'] },
  { label: 'A-30', table: 1, status: 'arithmetic', alpha: ZERO6, beta: ['1/4','3/4','1/10','3/10','7/10','9/10'] },
  { label: 'A-31', table: 1, status: 'thin',       alpha: ZERO6, beta: ['1/4','3/4','1/12','5/12','7/12','11/12'] },
  { label: 'A-32', table: 1, status: 'arithmetic', alpha: ZERO6, beta: ['1/5','2/5','3/5','4/5','1/6','5/6'] },
  { label: 'A-33', table: 1, status: 'arithmetic', alpha: ZERO6, beta: ['1/6','5/6','1/6','5/6','1/6','5/6'] },
  { label: 'A-34', table: 1, status: 'arithmetic', alpha: ZERO6, beta: ['1/6','5/6','1/8','3/8','5/8','7/8'] },
  { label: 'A-35', table: 1, status: 'arithmetic', alpha: ZERO6, beta: ['1/6','5/6','1/10','3/10','7/10','9/10'] },
  { label: 'A-36', table: 1, status: 'arithmetic', alpha: ZERO6, beta: ['1/6','5/6','1/12','5/12','7/12','11/12'] },
  { label: 'A-37', table: 1, status: 'thin',       alpha: ZERO6, beta: ['1/7','2/7','3/7','4/7','5/7','6/7'] },
  { label: 'A-38', table: 1, status: 'thin',       alpha: ZERO6, beta: ['1/9','2/9','4/9','5/9','7/9','8/9'] },
  { label: 'A-39', table: 1, status: 'arithmetic', alpha: ZERO6, beta: ['1/14','3/14','5/14','9/14','11/14','13/14'] },
  { label: 'A-40', table: 1, status: 'arithmetic', alpha: ZERO6, beta: ['1/18','5/18','7/18','11/18','13/18','17/18'] },
];

// Table 2 — more thin C-groups (C-15 omitted, see C15_TYPO).
const TABLE2: readonly CatalogRow[] = [
  { label: 'C-2',  table: 2, status: 'thin', alpha: ['0','0','0','0','1/3','2/3'], beta: ['1/2','1/2','1/2','1/2','1/4','3/4'] },
  { label: 'C-3',  table: 2, status: 'thin', alpha: ['0','0','0','0','1/3','2/3'], beta: ['1/2','1/2','1/2','1/2','1/6','5/6'] },
  { label: 'C-4',  table: 2, status: 'thin', alpha: ['0','0','0','0','1/3','2/3'], beta: ['1/2','1/2','1/4','1/4','3/4','3/4'] },
  { label: 'C-5',  table: 2, status: 'thin', alpha: ['0','0','0','0','1/3','2/3'], beta: ['1/2','1/2','1/5','2/5','3/5','4/5'] },
  { label: 'C-6',  table: 2, status: 'thin', alpha: ['0','0','0','0','1/3','2/3'], beta: ['1/2','1/2','1/8','3/8','5/8','7/8'] },
  { label: 'C-7',  table: 2, status: 'thin', alpha: ['0','0','0','0','1/3','2/3'], beta: ['1/2','1/2','1/10','3/10','7/10','9/10'] },
  { label: 'C-8',  table: 2, status: 'thin', alpha: ['0','0','0','0','1/3','2/3'], beta: ['1/2','1/2','1/12','5/12','7/12','11/12'] },
  { label: 'C-11', table: 2, status: 'thin', alpha: ['0','0','0','0','1/4','3/4'], beta: ['1/2','1/2','1/2','1/2','1/3','2/3'] },
  { label: 'C-12', table: 2, status: 'thin', alpha: ['0','0','0','0','1/4','3/4'], beta: ['1/2','1/2','1/3','1/3','2/3','2/3'] },
  { label: 'C-13', table: 2, status: 'thin', alpha: ['0','0','0','0','1/4','3/4'], beta: ['1/2','1/2','1/3','2/3','1/6','5/6'] },
  { label: 'C-14', table: 2, status: 'thin', alpha: ['0','0','0','0','1/4','3/4'], beta: ['1/2','1/2','1/5','2/5','3/5','4/5'] },
  { label: 'C-16', table: 2, status: 'thin', alpha: ['0','0','0','0','1/4','3/4'], beta: ['1/2','1/2','1/8','3/8','5/8','7/8'] },
  { label: 'C-17', table: 2, status: 'thin', alpha: ['0','0','0','0','1/4','3/4'], beta: ['1/2','1/2','1/10','3/10','7/10','9/10'] },
  { label: 'C-18', table: 2, status: 'thin', alpha: ['0','0','0','0','1/4','3/4'], beta: ['1/2','1/2','1/12','5/12','7/12','11/12'] },
  { label: 'C-19', table: 2, status: 'thin', alpha: ['0','0','0','0','1/4','3/4'], beta: ['1/7','2/7','3/7','4/7','5/7','6/7'] },
  { label: 'C-20', table: 2, status: 'thin', alpha: ['0','0','0','0','1/4','3/4'], beta: ['1/9','2/9','4/9','5/9','7/9','8/9'] },
  { label: 'C-21', table: 2, status: 'thin', alpha: ['0','0','0','0','1/6','5/6'], beta: ['1/2','1/2','1/2','1/2','1/3','2/3'] },
  { label: 'C-22', table: 2, status: 'thin', alpha: ['0','0','0','0','1/6','5/6'], beta: ['1/2','1/2','1/3','1/3','2/3','2/3'] },
  { label: 'C-23', table: 2, status: 'thin', alpha: ['0','0','0','0','1/6','5/6'], beta: ['1/2','1/2','1/3','2/3','1/4','3/4'] },
  { label: 'C-24', table: 2, status: 'thin', alpha: ['0','0','0','0','1/6','5/6'], beta: ['1/2','1/2','1/4','1/4','3/4','3/4'] },
  { label: 'C-25', table: 2, status: 'thin', alpha: ['0','0','0','0','1/6','5/6'], beta: ['1/2','1/2','1/5','2/5','3/5','4/5'] },
  { label: 'C-26', table: 2, status: 'thin', alpha: ['0','0','0','0','1/6','5/6'], beta: ['1/2','1/2','1/8','3/8','5/8','7/8'] },
  { label: 'C-27', table: 2, status: 'thin', alpha: ['0','0','0','0','1/6','5/6'], beta: ['1/2','1/2','1/10','3/10','7/10','9/10'] },
  { label: 'C-28', table: 2, status: 'thin', alpha: ['0','0','0','0','1/6','5/6'], beta: ['1/2','1/2','1/12','5/12','7/12','11/12'] },
  { label: 'C-33', table: 2, status: 'thin', alpha: ['0','0','0','0','1/6','5/6'], beta: ['1/7','2/7','3/7','4/7','5/7','6/7'] },
  { label: 'C-34', table: 2, status: 'thin', alpha: ['0','0','0','0','1/6','5/6'], beta: ['1/9','2/9','4/9','5/9','7/9','8/9'] },
  { label: 'C-35', table: 2, status: 'thin', alpha: ['0','0','1/3','2/3','1/4','3/4'], beta: ['1/2','1/2','1/5','2/5','3/5','4/5'] },
  { label: 'C-36', table: 2, status: 'thin', alpha: ['0','0','1/3','2/3','1/6','5/6'], beta: ['1/2','1/2','1/4','1/4','3/4','3/4'] },
  { label: 'C-37', table: 2, status: 'thin', alpha: ['0','0','1/3','2/3','1/6','5/6'], beta: ['1/2','1/2','1/5','2/5','3/5','4/5'] },
  { label: 'C-38', table: 2, status: 'thin', alpha: ['0','0','1/3','2/3','1/6','5/6'], beta: ['1/2','1/2','1/8','3/8','5/8','7/8'] },
  { label: 'C-40', table: 2, status: 'thin', alpha: ['0','0','1/4','1/4','3/4','3/4'], beta: ['1/2','1/2','1/3','2/3','1/3','2/3'] },
  { label: 'C-41', table: 2, status: 'thin', alpha: ['0','0','1/4','1/4','3/4','3/4'], beta: ['1/2','1/2','1/5','2/5','3/5','4/5'] },
  { label: 'C-43', table: 2, status: 'thin', alpha: ['0','0','1/4','3/4','1/6','5/6'], beta: ['1/2','1/2','1/3','1/3','2/3','2/3'] },
  { label: 'C-44', table: 2, status: 'thin', alpha: ['0','0','1/4','3/4','1/6','5/6'], beta: ['1/2','1/2','1/5','2/5','3/5','4/5'] },
  { label: 'C-45', table: 2, status: 'thin', alpha: ['0','0','1/4','3/4','1/6','5/6'], beta: ['1/2','1/2','1/8','3/8','5/8','7/8'] },
  { label: 'C-46', table: 2, status: 'thin', alpha: ['0','0','1/4','3/4','1/6','5/6'], beta: ['1/7','2/7','3/7','4/7','5/7','6/7'] },
  { label: 'C-48', table: 2, status: 'thin', alpha: ['0','0','1/6','1/6','5/6','5/6'], beta: ['1/2','1/2','1/3','1/3','2/3','2/3'] },
  { label: 'C-49', table: 2, status: 'thin', alpha: ['0','0','1/6','1/6','5/6','5/6'], beta: ['1/2','1/2','1/5','2/5','3/5','4/5'] },
  { label: 'C-50', table: 2, status: 'thin', alpha: ['0','0','1/6','1/6','5/6','5/6'], beta: ['1/2','1/2','1/8','3/8','5/8','7/8'] },
  { label: 'C-52', table: 2, status: 'thin', alpha: ['0','0','1/6','1/6','5/6','5/6'], beta: ['1/7','2/7','3/7','4/7','5/7','6/7'] },
  { label: 'C-53', table: 2, status: 'thin', alpha: ['0','0','1/6','1/6','5/6','5/6'], beta: ['1/9','2/9','4/9','5/9','7/9','8/9'] },
  { label: 'C-54', table: 2, status: 'thin', alpha: ['0','0','1/8','3/8','5/8','7/8'], beta: ['1/2','1/2','1/5','2/5','3/5','4/5'] },
  { label: 'C-56', table: 2, status: 'thin', alpha: ['0','0','1/10','3/10','7/10','9/10'], beta: ['1/2','1/2','1/5','2/5','3/5','4/5'] },
  { label: 'C-57', table: 2, status: 'thin', alpha: ['0','0','1/10','3/10','7/10','9/10'], beta: ['1/2','1/2','1/12','5/12','7/12','11/12'] },
  { label: 'C-58', table: 2, status: 'thin', alpha: ['0','0','1/10','3/10','7/10','9/10'], beta: ['1/7','2/7','3/7','4/7','5/7','6/7'] },
];

/**
 * C-15 anomaly. The paper prints β = (1/2,1/2,1/6,5/6,5/6,5/6) for C-15, which is
 * NOT closed under negation mod 1 (1/6 once, 5/6 thrice) ⇒ no real polynomial.
 * By the surrounding pattern the intended β is A-11's, (1/2,1/2,1/6,1/6,5/6,5/6).
 * Pending confirmation we OMIT C-15.
 */
export const C15_TYPO = {
  label: 'C-15',
  printedBeta: ['1/2', '1/2', '1/6', '5/6', '5/6', '5/6'],
  suspectedBeta: ['1/2', '1/2', '1/6', '1/6', '5/6', '5/6'],
} as const;

// Table 3 — open cases (thinness/arithmeticity unknown).
const TABLE3: readonly CatalogRow[] = [
  { label: 'C-32', table: 3, status: 'open', alpha: ['0','0','0','0','1/6','5/6'], beta: ['1/4','3/4','1/12','5/12','7/12','11/12'] },
  { label: 'C-47', table: 3, status: 'open', alpha: ['0','0','1/5','2/5','3/5','4/5'], beta: ['1/2','1/2','1/3','1/3','2/3','2/3'] },
  { label: 'C-55', table: 3, status: 'open', alpha: ['0','0','1/8','3/8','5/8','7/8'], beta: ['1/2','1/2','1/12','5/12','7/12','11/12'] },
];

const CATALOG: readonly CatalogRow[] = [...TABLE1, ...TABLE2, ...TABLE3];

const idFromLabel = (label: string): string => label.replace(/-/g, '');

function rowToExample(row: CatalogRow): SymplecticExample {
  return { id: idFromLabel(row.label), label: row.label, status: row.status, alpha: row.alpha, beta: row.beta };
}

/** The full BDN catalog as ready-to-use examples (88 groups, paper order). */
export const CATALOG_EXAMPLES: readonly SymplecticExample[] = CATALOG.map(rowToExample);

// ─── Featured subset ────────────────────────────────────────────────────────
// A hand-picked shortlist for the sp6-limit-sets / c32 demos — references into
// the catalog by label (no data re-stored), with the historical id pinned (the
// view-preset JSON keys off it) and an optional caption.

interface FeaturedSpec { label: string; id?: string; caption?: string; }

function featured(specs: readonly FeaturedSpec[]): readonly SymplecticExample[] {
  return specs.map((spec) => {
    const row = CATALOG_EXAMPLES.find((e) => e.label === spec.label);
    if (!row) throw new Error(`featured: no catalog group labelled ${spec.label}`);
    return { ...row, id: spec.id ?? row.id, caption: spec.caption };
  });
}

export const EXAMPLES: readonly SymplecticExample[] = featured([
  { label: 'A-1' },
  { label: 'A-17' },
  { label: 'C-2',  id: 'c2' },
  { label: 'C-32', id: 'c32', caption: 'open case · hull-overlay demo' },
  { label: 'C-47', id: 'c47' },
  { label: 'C-55', id: 'c55' },
]);

/** Look up a featured example by id. */
export function exampleById(id: string): SymplecticExample {
  const ex = EXAMPLES.find((e) => e.id === id);
  if (!ex) throw new Error(`unknown sp6 example id: ${id}`);
  return ex;
}
