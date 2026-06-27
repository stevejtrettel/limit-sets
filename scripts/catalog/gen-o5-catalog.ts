/**
 * Generator for src/examples/hypergeometric/degree5-orthogonal.ts, emitted from
 * the validated Bajpai–Singh CSV (orthogonal_hypergeometric_group_tables.csv, all
 * 77 groups), annotating each with its signature type, thin/arithmetic/open/finite
 * status, and the paper that established it. The catalog is generated, not
 * hand-edited: re-run after changing the CSV or annotations.
 *   node scripts/gen-o5-catalog.ts
 *
 * Status/source assignment by BS number (worked out from the BS tables + the
 * Bajpai–Nitsche O(5) paper, cross-checked against the prior 29-group catalog):
 *   1–7    O(4,1) thin        Fuchs–Meiri–Sarnak
 *   8–18   O(3,2) arithmetic  Venkataramana
 *   19–20  O(3,2) arithmetic  Singh
 *   21–43  O(3,2) arithmetic  Bajpai–Singh
 *   44–47  O(5)   finite      —
 *   48–67  O(3,2) thin/open/arith — BS Table 6; see maps below
 *   68–77  O(4,1) thin/open   — BS Table 7; see maps below
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CSV = fileURLToPath(new URL('./orthogonal_hypergeometric_group_tables.csv', import.meta.url));
const OUT = fileURLToPath(new URL('../../src/examples/hypergeometric/degree5-orthogonal.ts', import.meta.url));

const BDN = 'Bajpai–Nitsche (this O(5) paper)';
// BS Table 6 (48–67) and Table 7 (68–77) split by what the Bajpai–Nitsche paper
// proved (thin) vs left open, plus the one BSS-arithmetic case (#67).
const THIN_O32 = new Set([48, 49, 50, 51, 54, 56, 57, 58, 59, 60, 62, 65]);
const OPEN_O32 = new Set([52, 53, 55, 61, 63, 64, 66]);
const THIN_O41 = new Set([68, 69, 70, 71, 72, 73, 74, 75, 76]);
const OPEN_O41 = new Set([77]);

// The 29 groups that ALSO appear in Bajpai–Nitsche, "Thin Monodromy in O(5)":
// BS No. 48–77 except the arithmetic No. 67. Labels match that paper — §4
// "Case N of type O(X,Y)" for the thin ones, Table-2/4 position for the open.
// (Derived from the α,β cross-check between the two papers.)
const BDN_LABEL: Record<number, string> = {
  48: 'O(3,2) Case 1', 49: 'O(3,2) Case 2', 50: 'O(3,2) Case 3', 51: 'O(3,2) Case 4',
  54: 'O(3,2) Case 5', 56: 'O(3,2) Case 6', 57: 'O(3,2) Case 7', 58: 'O(3,2) Case 8',
  59: 'O(3,2) Case 9', 60: 'O(3,2) Case 10', 62: 'O(3,2) Case 11', 65: 'O(3,2) Case 12',
  52: 'O(3,2) open 1', 53: 'O(3,2) open 2', 55: 'O(3,2) open 3', 61: 'O(3,2) open 4',
  63: 'O(3,2) open 5', 64: 'O(3,2) open 6', 66: 'O(3,2) open 7',
  68: 'O(4,1) Case 1', 69: 'O(4,1) Case 2', 70: 'O(4,1) Case 3', 71: 'O(4,1) Case 4',
  72: 'O(4,1) Case 5', 73: 'O(4,1) Case 6', 74: 'O(4,1) Case 7', 75: 'O(4,1) Case 8',
  76: 'O(4,1) Case 9', 77: 'O(4,1) open 1',
};

function annotate(table: number, n: number): { type: string; status: string; source: string } {
  if (table === 1) return { type: 'O(4,1)', status: 'thin', source: 'Fuchs–Meiri–Sarnak' };
  if (table === 2) return { type: 'O(3,2)', status: 'arithmetic', source: 'Venkataramana' };
  if (table === 3) return { type: 'O(3,2)', status: 'arithmetic', source: 'Singh' };
  if (table === 4) return { type: 'O(3,2)', status: 'arithmetic', source: 'Bajpai–Singh' };
  if (table === 5) return { type: 'O(5)', status: 'finite', source: '—' };
  if (table === 6) {
    if (THIN_O32.has(n)) return { type: 'O(3,2)', status: 'thin', source: BDN };
    if (OPEN_O32.has(n)) return { type: 'O(3,2)', status: 'open', source: '—' };
    if (n === 67) return { type: 'O(3,2)', status: 'arithmetic', source: 'Bajpai–Singh–Singh' };
  }
  if (table === 7) {
    if (THIN_O41.has(n)) return { type: 'O(4,1)', status: 'thin', source: BDN };
    if (OPEN_O41.has(n)) return { type: 'O(4,1)', status: 'open', source: '—' };
  }
  throw new Error(`unclassified #${n} (table ${table})`);
}

function parseRow(line: string) {
  const m = line.match(/^(\d+),(\d+),"([^"]*)","([^"]*)"\s*$/);
  if (!m) return null;
  const tuple = (s: string) => s.replace(/[()]/g, '').split(',').map((x) => x.trim()).filter(Boolean);
  return { table: +m[1], n: +m[2], alpha: tuple(m[3]), beta: tuple(m[4]) };
}

const rows = readFileSync(CSV, 'utf8').split('\n').slice(1).map(parseRow).filter(Boolean) as NonNullable<ReturnType<typeof parseRow>>[];
const fmt = (t: readonly string[]) => `[${t.map((x) => `'${x}'`).join(', ')}]`;

// Sanity: BDN labels must cover exactly BS 48–77 minus the arithmetic No. 67.
const labeled = new Set(rows.filter((r) => BDN_LABEL[r.n]).map((r) => r.n));
const expected = Array.from({ length: 30 }, (_, i) => 48 + i).filter((n) => n !== 67);
if (labeled.size !== 29 || expected.some((n) => !labeled.has(n))) {
  throw new Error(`BDN label coverage mismatch: ${labeled.size} labeled, expected 29 (BS 48–77 except 67)`);
}

const body = rows.map((r) => {
  const a = annotate(r.table, r.n);
  const bdn = BDN_LABEL[r.n] ? `, bdn: '${BDN_LABEL[r.n]}'` : '';
  return `  { bsNo: ${String(r.n).padStart(2)}, table: ${r.table}, type: '${a.type}', status: ${`'${a.status}'`.padEnd(13)}, source: '${a.source}', alpha: ${fmt(r.alpha).padEnd(40)}, beta: ${fmt(r.beta).padEnd(48)}${bdn} },`;
}).join('\n');

const file = `/**
 * The full Bajpai–Singh degree-5 orthogonal hypergeometric atlas — all 77
 * monodromy groups, the data behind the o5-explorer demo.
 *
 * GENERATED by scripts/gen-o5-catalog.ts from orthogonal_hypergeometric_group_
 * tables.csv (a transcription of arXiv:1706.08791, Tables 1–7), cross-validated
 * against a second independent transcription and against the Bajpai–Nitsche
 * O(5) paper. Edit the generator, not this file.
 *
 * Each group is a pair (α, β) of five rotation numbers; the generators are the
 * companion matrices of f = ∏(x − e^{2πiαⱼ}) and g = ∏(x − e^{2πiβⱼ}) — built
 * from (α, β) on demand by the hypergeometric recipe (./recipe.ts). This file
 * is pure data + the row→example derivation; no matrices are stored here.
 *
 *   No. 1–7    O(4,1) thin        (Fuchs–Meiri–Sarnak)
 *   No. 8–43   O(3,2) arithmetic  (Venkataramana / Singh / Bajpai–Singh)
 *   No. 44–47  O(5)   finite      (positive-definite form — no limit set)
 *   No. 48–67  O(3,2) thin / open / arithmetic
 *   No. 68–77  O(4,1) thin / open
 * The 28 thin + 8 open are the limit-set headliners; arithmetic groups are
 * lattices, so their orbit closure is the whole boundary (dense, not fractal).
 */

import type { Walk } from './recipe.ts';

export type O5FormType = 'O(3,2)' | 'O(4,1)' | 'O(5)';
export type O5Status = 'thin' | 'arithmetic' | 'open' | 'finite';

/** This atlas's natural generating set: the free product {T, B} with T = B·A⁻¹
 *  an involution (Bajpai–Nitsche "Thin Monodromy in O(5)", Thm 1). */
export const ORTHOGONAL_DEGREE5_WALK: Walk = 'free-product';

export interface OrthogonalRow {
  /** Bajpai–Singh global numbering, 1–77. */
  bsNo: number;
  /** Source table in arXiv:1706.08791 (1–7). */
  table: number;
  type: O5FormType;
  status: O5Status;
  source: string;
  alpha: readonly string[];
  beta: readonly string[];
  /** Label in Bajpai–Nitsche "Thin Monodromy in O(5)" (only the 29 groups that
   *  appear there). */
  bdn?: string;
}

export interface OrthogonalExample {
  id: string;
  label: string;
  bsNo: number;
  type: O5FormType;
  status: O5Status;
  source: string;
  bdnLabel?: string;
  /** True if B = companion(g) has infinite order (β has a repeated rotation). */
  bInfinite: boolean;
  alpha: readonly string[];
  beta: readonly string[];
}

export const ROWS: readonly OrthogonalRow[] = [
${body}
];

// ─── Row → OrthogonalExample ────────────────────────────────────────────────

function gcd(a: number, b: number): number { return b === 0 ? a : gcd(b, a % b); }

/** A rotation reduced to lowest terms mod 1, as a canonical "num/den" string. */
function reduceRotation(s: string): string {
  const t = s.trim();
  const slash = t.indexOf('/');
  if (slash === -1) return '0';
  const p = parseInt(t.slice(0, slash), 10);
  const q = parseInt(t.slice(slash + 1), 10);
  const num = ((p % q) + q) % q;
  if (num === 0) return '0';
  const g = gcd(num, q) || 1;
  return \`\${num / g}/\${q / g}\`;
}

/** B = companion(g) has infinite order ⟺ g has a repeated root ⟺ β has a
 *  repeated rotation. */
function betaInfiniteOrder(beta: readonly string[]): boolean {
  const reduced = beta.map(reduceRotation);
  return new Set(reduced).size < reduced.length;
}

export function rowToExample(row: OrthogonalRow): OrthogonalExample {
  return {
    id: \`g\${row.bsNo}\`,
    label: \`№\${row.bsNo}\`,
    bsNo: row.bsNo,
    type: row.type,
    status: row.status,
    source: row.source,
    bdnLabel: row.bdn,
    bInfinite: betaInfiniteOrder(row.beta),
    alpha: row.alpha,
    beta: row.beta,
  };
}

/** The full atlas as ready-to-use examples (Bajpai–Singh order, No. 1–77). */
export const CATALOG_EXAMPLES: readonly OrthogonalExample[] = ROWS.map(rowToExample);
`;

writeFileSync(OUT, file);
console.log(`wrote ${OUT} with ${rows.length} groups`);
