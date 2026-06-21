/**
 * The full Bajpai–Nitsche catalog of degree-5 orthogonal hypergeometric groups
 * — the data behind the o5-explorer demo.
 *
 * Source: J. Bajpai, M. Nitsche, "Thin Monodromy in O(5)" (O5_monodromy.tex),
 * Tables 1–4. Each group is a pair (α, β) of five rotation numbers in ℚ/ℤ; its
 * generators are the companion matrices of f = ∏(x − e^{2πiαⱼ}) and
 * g = ∏(x − e^{2πiβⱼ}). We store (α, β, type, nature) and DERIVE the integer
 * polynomials via `hypergeometric.ts` (integer-snapped, conjugate-closure
 * checked) rather than hand-typing coefficients.
 *
 *   Table 1 — 12 groups of type O(3,2), proven thin in the article.
 *   Table 2 —  7 groups of type O(3,2), arithmeticity/thinness open.
 *   Table 3 —  9 groups of type O(4,1), proven thin in the article.
 *   Table 4 —  1 group  of type O(4,1), open.
 *
 * NB: Table 1's printed rows 10 and 11 (paper labels T13, T15) show
 * β = (½,½,½,⅔,⅔), which is NOT closed under negation mod 1 (two ⅔, no ⅓) and
 * has no real companion matrix. The Verification section (§4.1 Cases 10, 11)
 * gives the intended value β = (½,½,½,⅓,⅔); we use that. A bad transcription
 * would throw in `polynomialFromRotationStrings`, so errors can't pass silently.
 */

import type { O5Example, O5Type } from './examples.ts';
import { polynomialFromRotationStrings } from '../sp6/hypergeometric.ts';

export interface CatalogRow {
  /** Paper-facing label, e.g. 'O(3,2) №5'. */
  label: string;
  /** Which table it came from (1–4). */
  table: 1 | 2 | 3 | 4;
  type: O5Type;
  nature: 'thin' | 'open';
  alpha: readonly string[];
  beta: readonly string[];
}

const Z5: readonly string[] = ['0', '0', '0', '0', '0'];

// ─── Table 1 — O(3,2), thin (β data from §4.1 Verification, authoritative) ───
const TABLE1: readonly CatalogRow[] = [
  { label: 'O(3,2) №1',  table: 1, type: 'O(3,2)', nature: 'thin', alpha: Z5, beta: ['1/2','1/2','1/2','1/2','1/2'] },
  { label: 'O(3,2) №2',  table: 1, type: 'O(3,2)', nature: 'thin', alpha: Z5, beta: ['1/2','1/2','1/2','1/3','2/3'] },
  { label: 'O(3,2) №3',  table: 1, type: 'O(3,2)', nature: 'thin', alpha: Z5, beta: ['1/2','1/2','1/2','1/4','3/4'] },
  { label: 'O(3,2) №4',  table: 1, type: 'O(3,2)', nature: 'thin', alpha: Z5, beta: ['1/2','1/2','1/2','1/6','5/6'] },
  { label: 'O(3,2) №5',  table: 1, type: 'O(3,2)', nature: 'thin', alpha: Z5, beta: ['1/2','1/3','2/3','1/6','5/6'] },
  { label: 'O(3,2) №6',  table: 1, type: 'O(3,2)', nature: 'thin', alpha: Z5, beta: ['1/2','1/5','2/5','3/5','4/5'] },
  { label: 'O(3,2) №7',  table: 1, type: 'O(3,2)', nature: 'thin', alpha: Z5, beta: ['1/2','1/8','3/8','5/8','7/8'] },
  { label: 'O(3,2) №8',  table: 1, type: 'O(3,2)', nature: 'thin', alpha: Z5, beta: ['1/2','1/10','3/10','7/10','9/10'] },
  { label: 'O(3,2) №9',  table: 1, type: 'O(3,2)', nature: 'thin', alpha: Z5, beta: ['1/2','1/12','5/12','7/12','11/12'] },
  { label: 'O(3,2) №10', table: 1, type: 'O(3,2)', nature: 'thin', alpha: ['0','0','0','1/4','3/4'], beta: ['1/2','1/2','1/2','1/3','2/3'] },
  { label: 'O(3,2) №11', table: 1, type: 'O(3,2)', nature: 'thin', alpha: ['0','0','0','1/6','5/6'], beta: ['1/2','1/2','1/2','1/3','2/3'] },
  { label: 'O(3,2) №12', table: 1, type: 'O(3,2)', nature: 'thin', alpha: ['0','0','0','1/6','5/6'], beta: ['1/2','1/5','2/5','3/5','4/5'] },
];

// ─── Table 2 — O(3,2), open ──────────────────────────────────────────────────
const TABLE2: readonly CatalogRow[] = [
  { label: 'O(3,2) open №1', table: 2, type: 'O(3,2)', nature: 'open', alpha: Z5, beta: ['1/2','1/3','1/3','2/3','2/3'] },
  { label: 'O(3,2) open №2', table: 2, type: 'O(3,2)', nature: 'open', alpha: Z5, beta: ['1/2','1/3','2/3','1/4','3/4'] },
  { label: 'O(3,2) open №3', table: 2, type: 'O(3,2)', nature: 'open', alpha: Z5, beta: ['1/2','1/4','3/4','1/6','5/6'] },
  { label: 'O(3,2) open №4', table: 2, type: 'O(3,2)', nature: 'open', alpha: ['0','0','0','1/4','3/4'], beta: ['1/2','1/3','1/3','2/3','2/3'] },
  { label: 'O(3,2) open №5', table: 2, type: 'O(3,2)', nature: 'open', alpha: ['0','0','0','1/6','5/6'], beta: ['1/2','1/3','1/3','2/3','2/3'] },
  { label: 'O(3,2) open №6', table: 2, type: 'O(3,2)', nature: 'open', alpha: ['0','0','0','1/6','5/6'], beta: ['1/2','1/3','2/3','1/4','3/4'] },
  { label: 'O(3,2) open №7', table: 2, type: 'O(3,2)', nature: 'open', alpha: ['0','1/10','3/10','7/10','9/10'], beta: ['1/2','1/3','1/3','2/3','2/3'] },
];

// ─── Table 3 — O(4,1), thin ──────────────────────────────────────────────────
const TABLE3: readonly CatalogRow[] = [
  { label: 'O(4,1) №1', table: 3, type: 'O(4,1)', nature: 'thin', alpha: ['0','0','0','1/3','2/3'], beta: ['1/2','1/2','1/2','1/4','3/4'] },
  { label: 'O(4,1) №2', table: 3, type: 'O(4,1)', nature: 'thin', alpha: ['0','0','0','1/3','2/3'], beta: ['1/2','1/2','1/2','1/6','5/6'] },
  { label: 'O(4,1) №3', table: 3, type: 'O(4,1)', nature: 'thin', alpha: ['0','0','0','1/3','2/3'], beta: ['1/2','1/5','2/5','3/5','4/5'] },
  { label: 'O(4,1) №4', table: 3, type: 'O(4,1)', nature: 'thin', alpha: ['0','0','0','1/4','3/4'], beta: ['1/2','1/3','2/3','1/6','5/6'] },
  { label: 'O(4,1) №5', table: 3, type: 'O(4,1)', nature: 'thin', alpha: ['0','0','0','1/4','3/4'], beta: ['1/2','1/5','2/5','3/5','4/5'] },
  { label: 'O(4,1) №6', table: 3, type: 'O(4,1)', nature: 'thin', alpha: ['0','0','0','1/4','3/4'], beta: ['1/2','1/8','3/8','5/8','7/8'] },
  { label: 'O(4,1) №7', table: 3, type: 'O(4,1)', nature: 'thin', alpha: ['0','0','0','1/4','3/4'], beta: ['1/2','1/12','5/12','7/12','11/12'] },
  { label: 'O(4,1) №8', table: 3, type: 'O(4,1)', nature: 'thin', alpha: ['0','0','0','1/6','5/6'], beta: ['1/2','1/8','3/8','5/8','7/8'] },
  { label: 'O(4,1) №9', table: 3, type: 'O(4,1)', nature: 'thin', alpha: ['0','0','0','1/6','5/6'], beta: ['1/2','1/12','5/12','7/12','11/12'] },
];

// ─── Table 4 — O(4,1), open ──────────────────────────────────────────────────
const TABLE4: readonly CatalogRow[] = [
  { label: 'O(4,1) open №1', table: 4, type: 'O(4,1)', nature: 'open', alpha: ['0','1/10','3/10','7/10','9/10'], beta: ['1/2','1/5','2/5','3/5','4/5'] },
];

export const CATALOG: readonly CatalogRow[] = [...TABLE1, ...TABLE2, ...TABLE3, ...TABLE4];

// ─── Row → O5Example ─────────────────────────────────────────────────────────

function gcd(a: number, b: number): number { return b === 0 ? a : gcd(b, a % b); }

/** A rotation reduced to lowest terms mod 1, as a canonical "num/den" string. */
function reduceRotation(s: string): string {
  const t = s.trim();
  const slash = t.indexOf('/');
  if (slash === -1) return '0'; // integer ≡ 0 (mod 1)
  const p = parseInt(t.slice(0, slash), 10);
  const q = parseInt(t.slice(slash + 1), 10);
  const num = ((p % q) + q) % q;
  if (num === 0) return '0';
  const g = gcd(num, q) || 1;
  return `${num / g}/${q / g}`;
}

/** B = companion(g) has infinite order ⟺ g has a repeated root ⟺ β has a
 *  repeated rotation (a repeated root forces a non-trivial Jordan block). */
function betaInfiniteOrder(beta: readonly string[]): boolean {
  const reduced = beta.map(reduceRotation);
  return new Set(reduced).size < reduced.length;
}

/** Stable short id, e.g. 'O(4,1) №1' → 'o41-1', 'O(3,2) open №7' → 'o32-open-7'. */
function idFromLabel(label: string): string {
  const m = label.match(/O\((\d),(\d)\)\s*(open\s*)?№(\d+)/);
  if (m) return `o${m[1]}${m[2]}${m[3] ? '-open' : ''}-${m[4]}`;
  return label.toLowerCase().replace(/\W+/g, '-');
}

export function rowToExample(row: CatalogRow): O5Example {
  return {
    id: idFromLabel(row.label),
    label: row.label,
    type: row.type,
    nature: row.nature,
    bInfinite: betaInfiniteOrder(row.beta),
    alpha: row.alpha,
    beta: row.beta,
    coefflistf: polynomialFromRotationStrings(row.alpha),
    coefflistg: polynomialFromRotationStrings(row.beta),
  };
}

/** The full catalog as ready-to-use O5Examples (Tables 1→4, paper order). */
export const CATALOG_EXAMPLES: readonly O5Example[] = CATALOG.map(rowToExample);
