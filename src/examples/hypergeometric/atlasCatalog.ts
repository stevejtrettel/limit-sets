/**
 * The shape of a hypergeometric (α, β) atlas — the types and the row → example
 * derivation shared by every generated catalog (`degree-le6.ts`, `degree7.ts`).
 *
 * A catalog is a list of TABLES (one per degree + invariant-form type) and a
 * list of ROWS (one per (α, β) pair, in source-list order). This module holds
 * no data of its own: the generated files supply the rows, and `makeCatalog`
 * turns them into ready-to-use examples.
 *
 * A group is ⟨A, B⟩ with A = companion(∏(x − e^{2πiαⱼ})), B likewise from β —
 * built on demand by the hypergeometric recipe (./recipe.ts). No matrices are
 * stored anywhere in a catalog.
 */

import type { Walk } from './recipe.ts';

export type AtlasKind = 'orthogonal' | 'symplectic';

export interface AtlasTable {
  /** Stable key, from the source filename: 'd6-o42', 'd4-sp', 'd7-o43', … */
  key: string;
  /** Source pair-list filename. */
  file: string;
  degree: number;
  kind: AtlasKind;
  /** Display form: 'O(4,2)', 'O(6)' (definite), 'Sp(6,ℝ)'. */
  form: string;
  /** Exact signature (p, q) of the symmetric invariant form (up to overall
   *  sign) — orthogonal only. */
  signature: readonly [number, number] | null;
  /** Definite form ⇒ finite group ⇒ no limit set. */
  finite: boolean;
  /** 'free-product' on {T, B} where T = B·A⁻¹ is an involution (orthogonal);
   *  'free' on {A, B} where T is a transvection (symplectic). */
  walk: Walk;
  count: number;
}

export interface AtlasRow {
  /** '<table key>-<n>' with n the 1-based position in the source file. Stable. */
  id: string;
  table: string;
  n: number;
  alpha: readonly string[];
  beta: readonly string[];
}

export interface AtlasExample {
  id: string;
  /** '№n' within its table — the row's position in the source classification
   *  list. A stable citation key, not a mathematical ordering. */
  label: string;
  n: number;
  table: AtlasTable;
  /** True if A = companion(f) has infinite order (α has a repeated rotation). */
  aInfinite: boolean;
  /** True if B = companion(g) has infinite order (β has a repeated rotation). */
  bInfinite: boolean;
  alpha: readonly string[];
  beta: readonly string[];
}

export interface AtlasCatalog {
  /** Human name, for messages: 'degree ≤ 6', 'degree 7'. */
  name: string;
  tables: readonly AtlasTable[];
  rows: readonly AtlasRow[];
  /** Every row as a ready-to-use example, in table order. */
  examples: readonly AtlasExample[];
  tableByKey(key: string): AtlasTable;
  examplesInTable(key: string): AtlasExample[];
  exampleById(id: string): AtlasExample | undefined;
}

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
  return `${num / g}/${q / g}`;
}

/** companion(∏(x − e^{2πiθⱼ})) has infinite order ⟺ the tuple has a repeated
 *  rotation (a repeated root makes the matrix non-semisimple). */
function tupleInfiniteOrder(rots: readonly string[]): boolean {
  const reduced = rots.map(reduceRotation);
  return new Set(reduced).size < reduced.length;
}

export function makeCatalog(
  name: string, tables: readonly AtlasTable[], rows: readonly AtlasRow[],
): AtlasCatalog {
  const byKey = new Map(tables.map((t) => [t.key, t]));
  const tableByKey = (key: string): AtlasTable => {
    const t = byKey.get(key);
    if (!t) throw new Error(`unknown ${name} atlas table: ${key}`);
    return t;
  };
  const examples: readonly AtlasExample[] = rows.map((row) => ({
    id: row.id,
    label: `№${row.n}`,
    n: row.n,
    table: tableByKey(row.table),
    aInfinite: tupleInfiniteOrder(row.alpha),
    bInfinite: tupleInfiniteOrder(row.beta),
    alpha: row.alpha,
    beta: row.beta,
  }));
  const byId = new Map(examples.map((e) => [e.id, e]));
  return {
    name, tables, rows, examples, tableByKey,
    examplesInTable: (key) => examples.filter((e) => e.table.key === key),
    exampleById: (id) => byId.get(id),
  };
}
