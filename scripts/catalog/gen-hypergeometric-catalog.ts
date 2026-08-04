/**
 * Generator for the hypergeometric (α, β) atlases in
 * src/examples/hypergeometric/, emitted from the raw pair lists in
 * ./hypergeometric-*-pair-lists/*.txt (one file per degree + invariant-form
 * type, e.g. degree6-o42.txt ↦ the O(4,2) groups of degree 6):
 *
 *   node scripts/catalog/gen-hypergeometric-catalog.ts le6   → degree-le6.ts
 *   node scripts/catalog/gen-hypergeometric-catalog.ts deg7  → degree7.ts
 *   node scripts/catalog/gen-hypergeometric-catalog.ts       → both
 *
 * Every row is VERIFIED exactly before it is emitted, entirely over ℤ/ℚ:
 *   • α, β give integer companion polynomials (cyclotomicProduct throws if not);
 *   • the pair ⟨A, B⟩ has a UNIQUE invariant bilinear form, whose parity
 *     (symmetric/alternating) and exact Sylvester signature match the filename
 *     claim — o42 must come out O(4,2) (or (2,4): G is only defined up to sign),
 *     symplectic must come out alternating and nondegenerate;
 *   • T = B·A⁻¹ is tested for being an involution (⇔ det B/det A = −1), which
 *     decides the walk: 'free-product' on {T, B} when it is (the orthogonal
 *     tables), plain 'free' on {A, B} when it is not (the symplectic tables,
 *     where T is a transvection). The walk must be constant per table.
 * Any mismatch throws — a bad row cannot pass silently into a catalog.
 *
 * The emitted files are pure data; the types and the row → example derivation
 * they share live in src/examples/hypergeometric/atlasCatalog.ts.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { cyclotomicProduct } from '../../src/core/polynomial.ts';
import {
  type IMat, ifromInt, finverse, fclearDenominators, imul, iequal, iident,
} from '../../src/core/exactMatrix.ts';
import { invariantFormType } from '../../src/core/invariantForm.ts';

interface CatalogSpec {
  /** CLI selector. */
  slug: string;
  /** Human name, baked into the emitted catalog. */
  name: string;
  listsDir: string;
  out: string;
  /** Opening line of the emitted file's doc comment. */
  headline: string;
}

const CATALOGS: readonly CatalogSpec[] = [
  {
    slug: 'le6',
    name: 'degree ≤ 6',
    listsDir: 'hypergeometric-pair-lists',
    out: 'degree-le6.ts',
    headline: 'The full degree ≤ 6 hypergeometric (α, β) atlas — every pair from the\n'
      + ' * classification lists, one table per (degree, invariant-form type):',
  },
  {
    slug: 'deg7',
    name: 'degree 7',
    listsDir: 'hypergeometric-degree7-pair-lists',
    out: 'degree7.ts',
    headline: 'The degree 7 hypergeometric (α, β) atlas — every pair from the degree 7\n'
      + ' * classification lists, one table per invariant-form type. Degree 7 is odd,\n'
      + ' * so there are no symplectic tables; the limit sets live in RP⁶:',
  },
];

// ─── Parse the raw lists ─────────────────────────────────────────────────────

interface RawTable {
  file: string;
  degree: number;
  kind: 'orthogonal' | 'symplectic';
  /** Signature (p, q) claimed by the filename — orthogonal only. */
  claimed: [number, number] | null;
  rows: { alpha: string[]; beta: string[] }[];
}

function parseFile(dir: string, file: string): RawTable {
  const m = /^degree(\d)-(?:o(\d)(\d)|(symplectic))\.txt$/.exec(file);
  if (!m) throw new Error(`unrecognized pair-list filename: ${file}`);
  const degree = +m[1];
  const kind = m[4] ? 'symplectic' as const : 'orthogonal' as const;
  const claimed = m[4] ? null : [+m[2], +m[3]] as [number, number];
  if (claimed && claimed[0] + claimed[1] !== degree) {
    throw new Error(`${file}: signature (${claimed}) does not sum to degree ${degree}`);
  }

  const text = readFileSync(`${dir}/${file}`, 'utf8');
  const rows: RawTable['rows'] = [];
  for (const rm of text.matchAll(/\[\s*\(([^)]*)\)\s*,\s*\(([^)]*)\)\s*\]/g)) {
    const tuple = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);
    const alpha = tuple(rm[1]);
    const beta = tuple(rm[2]);
    if (alpha.length !== degree || beta.length !== degree) {
      throw new Error(`${file}: tuple lengths (${alpha.length}, ${beta.length}) ≠ degree ${degree}`);
    }
    rows.push({ alpha, beta });
  }
  if (rows.length === 0) throw new Error(`${file}: no rows parsed`);

  const seen = new Set<string>();
  for (const r of rows) {
    const key = `${r.alpha.join(',')}|${r.beta.join(',')}`;
    if (seen.has(key)) throw new Error(`${file}: duplicate pair ${key}`);
    seen.add(key);
  }
  return { file, degree, kind, claimed, rows };
}

// ─── Exact verification ──────────────────────────────────────────────────────

/** Integer companion matrix (same convention as core/matrix.ts companion:
 *  subdiagonal 1s, last column −(c₀…c_{n−1})). */
function icompanion(coeff: readonly number[]): IMat {
  const n = coeff.length - 1;
  if (coeff[0] !== 1) throw new Error('icompanion: not monic');
  const C: IMat = Array.from({ length: n }, () => Array<bigint>(n).fill(0n));
  for (let j = 0; j < n - 1; j++) C[j + 1][j] = 1n;
  for (let r = 0; r < n; r++) C[r][n - 1] = BigInt(-coeff[n - r]);
  return C;
}

/** A⁻¹ over ℤ (throws if A is singular or det ≠ ±1). */
function iinverse(A: IMat): IMat {
  const inv = finverse(ifromInt(A));
  if (!inv) throw new Error('iinverse: singular matrix');
  const { M, scale } = fclearDenominators(inv);
  if (scale !== 1n) throw new Error('iinverse: inverse is not integral (det ≠ ±1)');
  return M;
}

interface VerifiedTable extends RawTable {
  key: string;
  form: string;
  signature: [number, number] | null;
  finite: boolean;
  walk: 'free' | 'free-product';
}

function verifyTable(t: RawTable): VerifiedTable {
  const slug = t.kind === 'symplectic' ? 'sp' : `o${t.claimed![0]}${t.claimed![1]}`;
  const key = `d${t.degree}-${slug}`;
  let walk: 'free' | 'free-product' | null = null;

  for (const [i, row] of t.rows.entries()) {
    const where = `${t.file} row ${i + 1}`;
    const A = icompanion(cyclotomicProduct(row.alpha));
    const B = icompanion(cyclotomicProduct(row.beta));

    const ft = invariantFormType([A, B]);
    if (ft.kind !== t.kind) throw new Error(`${where}: invariant form is ${ft.kind}, filename claims ${t.kind}`);
    if (t.kind === 'orthogonal') {
      const { pos, neg } = ft.signature!;
      const [p, q] = t.claimed!;
      // G is unique only up to sign, so accept (p,q) or (q,p).
      if (!((pos === p && neg === q) || (pos === q && neg === p))) {
        throw new Error(`${where}: signature (${pos},${neg}) ≠ claimed O(${p},${q})`);
      }
    }

    const T = imul(B, iinverse(A));
    const rowWalk = iequal(imul(T, T), iident(T.length)) ? 'free-product' : 'free';
    if (walk === null) walk = rowWalk;
    else if (walk !== rowWalk) throw new Error(`${where}: walk ${rowWalk} differs from table's ${walk}`);
  }

  const finite = t.kind === 'orthogonal' && t.claimed![1] === 0;
  const form = t.kind === 'symplectic'
    ? `Sp(${t.degree},ℝ)`
    : finite ? `O(${t.claimed![0]})` : `O(${t.claimed![0]},${t.claimed![1]})`;
  return { ...t, key, form, signature: t.claimed, finite, walk: walk! };
}

// ─── Emit ────────────────────────────────────────────────────────────────────

const fmtTuple = (t: readonly string[]) => `[${t.map((x) => `'${x}'`).join(', ')}]`;

function generate(spec: CatalogSpec): void {
  const listsDir = fileURLToPath(new URL(spec.listsDir, import.meta.url));
  const out = fileURLToPath(new URL(`../../src/examples/hypergeometric/${spec.out}`, import.meta.url));

  const verified = readdirSync(listsDir)
    .filter((f) => f.endsWith('.txt'))
    .map((f) => parseFile(listsDir, f))
    .sort((a, b) => a.degree - b.degree || a.file.localeCompare(b.file))
    .map(verifyTable);

  const tableLines = verified.map((t) =>
    `  { key: '${t.key}', file: '${t.file}', degree: ${t.degree}, kind: '${t.kind}', ` +
    `form: '${t.form}', signature: ${t.signature ? `[${t.signature[0]}, ${t.signature[1]}]` : 'null'}, ` +
    `finite: ${t.finite}, walk: '${t.walk}', count: ${t.rows.length} },`,
  ).join('\n');

  const rowLines = verified.map((t) => {
    const rows = t.rows.map((r, i) =>
      `  { id: '${t.key}-${i + 1}', table: '${t.key}', n: ${i + 1}, ` +
      `alpha: ${fmtTuple(r.alpha)}, beta: ${fmtTuple(r.beta)} },`,
    ).join('\n');
    return `  // ${t.file} — ${t.form}, ${t.rows.length} groups\n${rows}`;
  }).join('\n');

  const summary = verified.map((t) =>
    ` *   ${t.key.padEnd(8)} ${t.form.padEnd(9)} ${String(t.rows.length).padStart(3)} groups` +
    `  walk: ${t.walk}${t.finite ? '  (definite — finite, no limit set)' : ''}`,
  ).join('\n');

  const total = verified.reduce((s, t) => s + t.rows.length, 0);

  const file = `/**
 * ${spec.headline}
 *
${summary}
 *
 * GENERATED by scripts/catalog/gen-hypergeometric-catalog.ts ${spec.slug} from the
 * raw pair lists in scripts/catalog/${spec.listsDir}/. Edit the lists or the
 * generator, not this file. Every row was verified exactly on emission (integer
 * companion polynomials; unique invariant form whose parity and Sylvester
 * signature match the table; walk decided by an exact T = B·A⁻¹ involution
 * test) — the gate scripts/tests/hypergeometric-atlas-gates.ts re-derives all of
 * it from this file's data.
 *
 * Pure data: the types and the row → example derivation live in
 * ./atlasCatalog.ts.
 */

import {
  type AtlasTable, type AtlasRow, type AtlasExample, makeCatalog,
} from './atlasCatalog.ts';

export const TABLES: readonly AtlasTable[] = [
${tableLines}
];

export const ROWS: readonly AtlasRow[] = [
${rowLines}
];

/** The ${spec.name} atlas: ${total} groups in ${verified.length} tables. */
export const CATALOG = makeCatalog('${spec.name}', TABLES, ROWS);

export const CATALOG_EXAMPLES: readonly AtlasExample[] = CATALOG.examples;
export const tableByKey = CATALOG.tableByKey;
export const examplesInTable = CATALOG.examplesInTable;
`;

  writeFileSync(out, file);
  console.log(`wrote ${out}:`);
  for (const t of verified) console.log(`  ${t.key.padEnd(8)} ${t.form.padEnd(9)} ${String(t.rows.length).padStart(3)} groups  walk=${t.walk}${t.finite ? '  finite' : ''}`);
  console.log(`  total ${total} groups in ${verified.length} tables`);
}

const which = process.argv[2];
const specs = which ? CATALOGS.filter((c) => c.slug === which) : CATALOGS;
if (specs.length === 0) {
  console.error(`unknown catalog '${which}' — expected one of ${CATALOGS.map((c) => c.slug).join(', ')}`);
  process.exit(1);
}
for (const spec of specs) generate(spec);
