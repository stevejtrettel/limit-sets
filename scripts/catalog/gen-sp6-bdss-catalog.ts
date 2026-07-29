/**
 * Generator for src/examples/hypergeometric/degree6-symplectic-bdss.ts — the
 * FULL Bajpai–Doña–Singh–Singh degree-6 symplectic atlas, all 458 groups.
 *
 *   node scripts/catalog/gen-sp6-bdss-catalog.ts
 *
 * Source: J. Bajpai, D. Doña, S. Singh, S. V. Singh, "Symplectic hypergeometric
 * groups of degree six", J. Algebra 575 (2021) 256–273 (arXiv:2003.10191). The
 * LaTeX source lives at the repo root as `Sp6-May14,_2020.tex`; this script
 * parses its four longtables directly, so the transcription is mechanical rather
 * than hand-typed.
 *
 *   Table A —  40 groups, α = (0,0,0,0,0,0) (maximally unipotent). β column only.
 *   Table B — 143 arithmetic by BDSS Prop. 1. α and β columns.
 *   Table C — 211 arithmetic by Singh–Venkataramana. Two entries per LaTeX row.
 *   Table D —  64 open as of 2020. Two entries per LaTeX row.
 *              40 + 143 + 211 + 64 = 458.
 *
 * STATUS PROVENANCE. BDSS's own status columns are from 2020 and are stale for
 * Tables A and D, so status is assigned per table:
 *
 *   Table B, C  → 'arithmetic'. Proved is proved; these never change.
 *   Table A, D  → whatever the Bajpai–Doña–Nitsche catalog says, joined by the
 *                 canonical (α, β) key — NOT by row number. (Row numbers do not
 *                 line up: C-32 ↔ D#32 but C-47 ↔ D#48 and C-55 ↔ D#58.)
 *   Table D rows with no BDN match → 'unknown', declared honestly rather than
 *                 guessed. These were resolved somewhere between 2021 and now;
 *                 we do not hold the citation.
 *
 * The generator FAILS LOUDLY on any rotation tuple that is not conjugate-closed
 * and is not in the declared TYPOS list below, so an unnoticed transcription
 * error cannot pass silently.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { cyclotomicProduct } from '../../src/core/polynomial.ts';
import { CATALOG_EXAMPLES as BDN_EXAMPLES } from '../../src/examples/hypergeometric/degree6-symplectic.ts';

const TEX = fileURLToPath(new URL('../../Sp6-May14,_2020.tex', import.meta.url));
const OUT = fileURLToPath(new URL('../../src/examples/hypergeometric/degree6-symplectic-bdss.ts', import.meta.url));

type Table = 'A' | 'B' | 'C' | 'D';

/**
 * Declared typo corrections. Each is a printed tuple that is NOT closed under
 * r ↦ −r mod 1 (so it defines no real polynomial), together with the reading the
 * rest of the paper makes unambiguous. Matched by exact printed tuple, so every
 * occurrence is fixed and counted — the generator reports the tally.
 *
 *   (1/14,…,11/14,11/14) — 11/14 twice, 13/14 absent. Every other occurrence of
 *       the Φ₁₄ tuple in the paper ends 13/14.
 *   (1/18,…,13/18,15/18) — 15/18 = 5/6, whose conjugate 1/6 is absent, and 17/18
 *       (the conjugate of 1/18) is absent. Every other occurrence of the Φ₁₈
 *       tuple in the paper ends 17/18.
 *
 * The generator prints the exact (table, row, α-or-β) of every correction it
 * applies, so the edits are auditable against the printed paper.
 *
 * This is the same species of error as the C-15 typo already tracked in
 * degree6-symplectic.ts (C15_TYPO), which is OMITTED rather than corrected
 * because there the intended reading is genuinely ambiguous. Here it is not.
 */
const TYPOS: readonly { printed: readonly string[]; corrected: readonly string[]; note: string }[] = [
  {
    printed:   ['1/14', '3/14', '5/14', '9/14', '11/14', '11/14'],
    corrected: ['1/14', '3/14', '5/14', '9/14', '11/14', '13/14'],
    note: 'Table B #40: 11/14 printed twice; 13/14 absent',
  },
  {
    printed:   ['1/18', '5/18', '7/18', '11/18', '13/18', '15/18'],
    corrected: ['1/18', '5/18', '7/18', '11/18', '13/18', '17/18'],
    note: 'Φ₁₈ tuple printed with 15/18 for 17/18',
  },
];

const ZERO6: readonly string[] = ['0', '0', '0', '0', '0', '0'];

// ─── LaTeX → rotation tuples ────────────────────────────────────────────────

/** One table cell → its rotation tuple, e.g. `$\big(\frac{1}{2},0\big)$` → ['1/2','0']. */
function parseTuple(cell: string): string[] {
  const s = cell
    .replace(/\\frac\s*\{\s*(\d+)\s*\}\s*\{\s*(\d+)\s*\}/g, '$1/$2') // \frac{p}{q} → p/q
    .replace(/\\[a-zA-Z]+/g, ' ')                                     // \big, \emph, …
    .replace(/[$\\(){}[\]]/g, ' ');                                   // delimiters
  return s.split(',').map((t) => t.trim()).filter((t) => t.length > 0);
}

const ROTATION = /^(0|\d+\/\d+)$/;

function checkedTuple(cell: string, where: string): string[] {
  const t = parseTuple(cell);
  if (t.length !== 6) throw new Error(`${where}: parsed ${t.length} rotations, expected 6 — from ${JSON.stringify(cell.trim())}`);
  for (const r of t) if (!ROTATION.test(r)) throw new Error(`${where}: "${r}" is not a rotation number`);
  return t;
}

/** The body rows of the one longtable inside a section, header dropped. */
function longtableRows(section: string, where: string): string[][] {
  const m = section.match(/\\begin\{longtable\}[^\n]*\n([\s\S]*?)\\end\{longtable\}/);
  if (!m) throw new Error(`${where}: no longtable found`);
  return m[1]
    .replace(/\\hline/g, '')
    .split(/\\\\/)
    .map((r) => r.trim())
    .filter((r) => r.length > 0 && !r.includes('S.No.'))
    .map((r) => r.split('&').map((c) => c.trim()));
}

function sectionFor(tex: string, table: Table): string {
  const parts = tex.split(/\\section\{Table[ -]([ABCD])/);
  // parts = [pre, 'A', bodyA, 'B', bodyB, …]
  for (let i = 1; i < parts.length; i += 2) if (parts[i] === table) return parts[i + 1];
  throw new Error(`Table ${table}: section not found`);
}

interface RawRow { table: Table; row: number; alpha: string[]; beta: string[] }

function rowNumber(cell: string, where: string): number {
  const m = cell.match(/(\d+)/); // Table B #142 is printed as `{\emph{142}}*`
  if (!m) throw new Error(`${where}: no row number in ${JSON.stringify(cell)}`);
  return Number(m[1]);
}

function parseTable(tex: string, table: Table): RawRow[] {
  const rows = longtableRows(sectionFor(tex, table), `Table ${table}`);
  const out: RawRow[] = [];
  for (const cells of rows) {
    if (table === 'A') {
      // S.No | β | |lc(f−g)| | v | γ | Arithmetic       (α is implicitly zero)
      const row = rowNumber(cells[0], `Table A`);
      out.push({ table, row, alpha: [...ZERO6], beta: checkedTuple(cells[1], `Table A #${row} β`) });
    } else if (table === 'B') {
      // S.No | α | β | v | γ
      const row = rowNumber(cells[0], `Table B`);
      out.push({
        table, row,
        alpha: checkedTuple(cells[1], `Table B #${row} α`),
        beta: checkedTuple(cells[2], `Table B #${row} β`),
      });
    } else {
      // Two entries per LaTeX row: S.No | α | β || S.No | α | β
      for (const off of [0, 3]) {
        const [n, a, b] = [cells[off], cells[off + 1], cells[off + 2]];
        if (!n || !a || !b) continue; // Table C's final row has an empty second half
        const row = rowNumber(n, `Table ${table}`);
        out.push({
          table, row,
          alpha: checkedTuple(a, `Table ${table} #${row} α`),
          beta: checkedTuple(b, `Table ${table} #${row} β`),
        });
      }
    }
  }
  return out;
}

// ─── Typo correction + conjugate-closure gate ───────────────────────────────

const typoHits = new Map<string, string[]>();
/** Per-row audit note, so a corrected row carries its own provenance. */
const rowCorrections = new Map<RawRow, string[]>();

function correct(row: RawRow, slot: 'α' | 'β', tuple: string[]): string[] {
  for (const t of TYPOS) {
    if (t.printed.length === tuple.length && t.printed.every((r, i) => r === tuple[i])) {
      const where = `Table ${row.table} #${row.row} ${slot}`;
      (typoHits.get(t.note) ?? typoHits.set(t.note, []).get(t.note)!).push(where);
      // Record BOTH the printed and the restored tuple: the row is then
      // self-auditing against the paper without consulting the generator.
      const note = `${slot} printed (${t.printed.join(',')}) — read as (${t.corrected.join(',')})`;
      (rowCorrections.get(row) ?? rowCorrections.set(row, []).get(row)!).push(note);
      return [...t.corrected];
    }
  }
  return tuple;
}

/** Throws unless the tuple yields a real integer polynomial (conjugate-closed). */
function assertConjugateClosed(tuple: readonly string[], where: string): void {
  try {
    cyclotomicProduct(tuple);
  } catch (e) {
    throw new Error(`${where}: (${tuple.join(',')}) — ${(e as Error).message}`);
  }
}

// ─── Canonical (α, β) key, for the join against the BDN catalog ─────────────

function gcd(a: number, b: number): number { return b === 0 ? a : gcd(b, a % b); }

/** A rotation reduced mod 1 to lowest terms, as a canonical string. */
function reduce(s: string): string {
  const slash = s.indexOf('/');
  if (slash === -1) return '0';
  const p = Number(s.slice(0, slash));
  const q = Number(s.slice(slash + 1));
  const num = ((p % q) + q) % q;
  if (num === 0) return '0';
  const g = gcd(num, q) || 1;
  return `${num / g}/${q / g}`;
}

/** Order-independent key: rotation tuples are multisets, so sort before joining. */
const tupleKey = (t: readonly string[]) => t.map(reduce).sort().join(',');
const groupKey = (alpha: readonly string[], beta: readonly string[]) => `${tupleKey(alpha)}|${tupleKey(beta)}`;

// ─── Build ──────────────────────────────────────────────────────────────────

const tex = readFileSync(TEX, 'utf8');
const raw: RawRow[] = (['A', 'B', 'C', 'D'] as const).flatMap((t) => parseTable(tex, t));

for (const r of raw) {
  r.alpha = correct(r, 'α', r.alpha);
  r.beta = correct(r, 'β', r.beta);
  assertConjugateClosed(r.alpha, `Table ${r.table} #${r.row} α`);
  assertConjugateClosed(r.beta, `Table ${r.table} #${r.row} β`);
}

// The BDN catalog, keyed for the join.
const bdnByKey = new Map(BDN_EXAMPLES.map((e) => [groupKey(e.alpha, e.beta), e]));

const SOURCE_B = 'BDSS Prop. 1 (arXiv:2003.10191)';
const SOURCE_C = 'Singh–Venkataramana (BDSS Table C)';
const SOURCE_BDN = 'Bajpai–Doña–Nitsche (arXiv:2112.12111)';

interface Built extends RawRow { status: string; source: string; bdn?: string; corrected?: string }

const built: Built[] = raw.map((r) => {
  const hit = bdnByKey.get(groupKey(r.alpha, r.beta));
  const corrected = rowCorrections.get(r)?.join('; ');
  if (r.table === 'B') return { ...r, status: 'arithmetic', source: SOURCE_B, bdn: hit?.label, corrected };
  if (r.table === 'C') return { ...r, status: 'arithmetic', source: SOURCE_C, bdn: hit?.label, corrected };
  // Tables A and D: BDSS's own status is stale; defer to BDN where it reaches.
  if (hit) return { ...r, status: hit.status, source: SOURCE_BDN, bdn: hit.label, corrected };
  return { ...r, status: 'unknown', source: '—', corrected };
});

// ─── Gates ──────────────────────────────────────────────────────────────────

const counts = { A: 0, B: 0, C: 0, D: 0 };
for (const r of built) counts[r.table]++;
const EXPECTED = { A: 40, B: 143, C: 211, D: 64 };
for (const t of ['A', 'B', 'C', 'D'] as const) {
  if (counts[t] !== EXPECTED[t]) throw new Error(`Table ${t}: parsed ${counts[t]} rows, paper says ${EXPECTED[t]}`);
}
if (built.length !== 458) throw new Error(`parsed ${built.length} groups, expected 458`);

// Table A must reproduce BDN Table 1 exactly — 40 rows already in the repo, in
// the same order. This is the parser's free correctness gate.
const tableA = built.filter((r) => r.table === 'A');
const bdnTable1 = BDN_EXAMPLES.filter((e) => e.label.startsWith('A-'));
if (tableA.length !== bdnTable1.length) throw new Error(`Table A has ${tableA.length} rows, BDN Table 1 has ${bdnTable1.length}`);
tableA.forEach((r, i) => {
  const e = bdnTable1[i];
  if (groupKey(r.alpha, r.beta) !== groupKey(e.alpha, e.beta)) {
    throw new Error(`Table A #${r.row} ≠ BDN ${e.label}:\n  BDSS β = (${r.beta.join(',')})\n  BDN  β = (${e.beta.join(',')})`);
  }
  if (r.bdn !== e.label) throw new Error(`Table A #${r.row} joined to ${r.bdn ?? 'nothing'}, expected ${e.label} (positional match)`);
});

// Every group must be distinct: BDSS already quotients by the scalar shift
// f(x) ↔ f(−x), so the 458 are pairwise inequivalent.
const seen = new Map<string, Built>();
for (const r of built) {
  const k = groupKey(r.alpha, r.beta);
  const prev = seen.get(k);
  if (prev) throw new Error(`duplicate group: Table ${prev.table} #${prev.row} and Table ${r.table} #${r.row}`);
  seen.set(k, r);
}

// ─── Emit ───────────────────────────────────────────────────────────────────

const fmt = (t: readonly string[]) => `[${t.map((x) => `'${x}'`).join(',')}]`;

const body = built.map((r) => {
  const bdn = r.bdn ? `, bdn: '${r.bdn}'` : '';
  const fix = r.corrected ? `, corrected: '${r.corrected}'` : '';
  return `  { table: '${r.table}', row: ${String(r.row).padStart(3)}, status: ${`'${r.status}'`.padEnd(12)}, source: '${r.source}', alpha: ${fmt(r.alpha).padEnd(46)}, beta: ${fmt(r.beta).padEnd(52)}${bdn}${fix} },`;
}).join('\n');

const joined = built.filter((r) => r.bdn).length;
const unknown = built.filter((r) => r.status === 'unknown').length;
const byStatus = built.reduce<Record<string, number>>((m, r) => ((m[r.status] = (m[r.status] ?? 0) + 1), m), {});

const file = `/**
 * The full Bajpai–Doña–Singh–Singh degree-6 symplectic hypergeometric atlas —
 * all 458 groups, the data behind the sp6-explorer demo's wide-browse mode.
 *
 * GENERATED by scripts/catalog/gen-sp6-bdss-catalog.ts, which parses the four
 * longtables of \`Sp6-May14,_2020.tex\` (the LaTeX source of J. Bajpai, D. Doña,
 * S. Singh, S. V. Singh, "Symplectic hypergeometric groups of degree six",
 * J. Algebra 575 (2021) 256–273, arXiv:2003.10191) directly. Edit the generator,
 * not this file.
 *
 * Each group is a pair (α, β) of six rotation numbers; the generators are the
 * companion matrices of f = ∏(x − e^{2πiαⱼ}) and g = ∏(x − e^{2πiβⱼ}), built on
 * demand by the shared hypergeometric recipe (./recipe.ts). No matrices here.
 *
 *   Table A —  40 groups with α = (0,0,0,0,0,0) (maximally unipotent).
 *              Identical to BDN Table 1 (A-1…A-40), verified row by row.
 *   Table B — 143 arithmetic by BDSS Proposition 1.
 *   Table C — 211 arithmetic by Singh–Venkataramana.
 *   Table D —  64 groups open as of 2020.
 *
 * STATUS. BDSS's own status columns are stale for Tables A and D (they predate
 * Bajpai–Doña–Nitsche), so:
 *   - Tables B and C carry 'arithmetic' — proved is proved.
 *   - Tables A and D take their status from the BDN catalog
 *     (./degree6-symplectic.ts), joined by canonical (α, β), never by row
 *     number: C-32 ↔ D#32 but C-47 ↔ D#48 and C-55 ↔ D#58.
 *   - Table D rows the BDN catalog does not reach are 'unknown' — resolved in
 *     the literature between 2021 and now, but we do not hold the citation.
 *     Declared honestly rather than guessed.
 *
 * Counts at generation time: ${Object.entries(byStatus).map(([s, n]) => `${n} ${s}`).join(', ')}.
 * ${joined} of the 458 also carry a BDN label.
 *
 * CORRECTED TUPLES. Two printed tuples are not closed under r ↦ −r mod 1, so as
 * printed they define no real polynomial. Both readings are unambiguous from the
 * rest of the paper, so they are corrected rather than omitted — the opposite
 * call from C15_TYPO in ./degree6-symplectic.ts, whose intended reading genuinely
 * is ambiguous. Every edit, listed so it can be checked against the paper:
 *
${[...typoHits].map(([note, wheres]) =>
  ` *   ${note}\n${wheres.map((w) => ` *     ${w}`).join('\n')}`).join('\n *\n')}
 */

import type { Walk } from './recipe.ts';
import { SYMPLECTIC_DEGREE6_WALK } from './degree6-symplectic.ts';

/** Which BDSS longtable a group comes from. */
export type BdssTable = 'A' | 'B' | 'C' | 'D';

/** 'unknown' = open in BDSS (2020) and not reached by the BDN catalog; resolved
 *  in the literature since, but not by a source this repo holds. Distinct from
 *  'open', which is BDN's three genuinely-unresolved cases C-32/47/55. */
export type BdssStatus = 'thin' | 'arithmetic' | 'open' | 'unknown';

/** This atlas walks the same generating set as the BDN catalog. */
export const BDSS_WALK: Walk = SYMPLECTIC_DEGREE6_WALK;

export interface BdssRow {
  table: BdssTable;
  /** Row number as printed in that table (1-based). */
  row: number;
  status: BdssStatus;
  /** Where \`status\` comes from. */
  source: string;
  alpha: readonly string[];
  beta: readonly string[];
  /** BDN label (A-n / C-n), for the ${joined} groups that also appear there. */
  bdn?: string;
  /**
   * Present iff this row's printed tuple was not conjugate-closed and has been
   * read as the value the rest of the paper makes unambiguous. Records what was
   * PRINTED as well as what was used, so the row can be checked against the
   * paper on its own. ${built.filter((r) => r.corrected).length} of the 458 rows carry one.
   */
  corrected?: string;
}

export interface BdssExample {
  id: string;
  label: string;
  table: BdssTable;
  row: number;
  status: BdssStatus;
  source: string;
  /** BDN label where one exists, e.g. 'C-32'. */
  bdnLabel?: string;
  /** Set iff the paper's printed tuple was corrected; see BdssRow.corrected. */
  corrected?: string;
  alpha: readonly string[];
  beta: readonly string[];
}

export const ROWS: readonly BdssRow[] = [
${body}
];

export function rowToExample(r: BdssRow): BdssExample {
  return {
    id: \`bdss\${r.table}\${r.row}\`,
    label: \`BDSS \${r.table}-\${r.row}\`,
    table: r.table,
    row: r.row,
    status: r.status,
    source: r.source,
    bdnLabel: r.bdn,
    corrected: r.corrected,
    alpha: r.alpha,
    beta: r.beta,
  };
}

/** The full atlas as ready-to-use examples (BDSS order, Tables A→D). */
export const CATALOG_EXAMPLES: readonly BdssExample[] = ROWS.map(rowToExample);

/** The rows whose printed tuple was corrected — the complete audit list. */
export const CORRECTED: readonly BdssExample[] = CATALOG_EXAMPLES.filter((e) => e.corrected);

/** Canonical join key — rotation tuples are multisets, so reduced and sorted.
 *  Use this to cross-reference against the BDN catalog. */
export function bdssGroupKey(alpha: readonly string[], beta: readonly string[]): string {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const reduce = (s: string): string => {
    const i = s.indexOf('/');
    if (i === -1) return '0';
    const p = Number(s.slice(0, i)), q = Number(s.slice(i + 1));
    const num = ((p % q) + q) % q;
    if (num === 0) return '0';
    const g = gcd(num, q) || 1;
    return \`\${num / g}/\${q / g}\`;
  };
  const key = (t: readonly string[]) => t.map(reduce).sort().join(',');
  return \`\${key(alpha)}|\${key(beta)}\`;
}
`;

writeFileSync(OUT, file);

console.log(`wrote ${OUT}`);
console.log(`  458 groups: A=${counts.A} B=${counts.B} C=${counts.C} D=${counts.D}`);
console.log(`  status: ${Object.entries(byStatus).map(([s, n]) => `${n} ${s}`).join(', ')}`);
console.log(`  BDN join: ${joined}/458 carry a BDN label; ${unknown} Table-D rows left 'unknown'`);
for (const [note, wheres] of typoHits) {
  console.log(`  typo corrected ×${wheres.length}: ${note}`);
  for (const w of wheres) console.log(`      ${w}`);
}
for (const t of TYPOS) if (!typoHits.has(t.note)) console.log(`  WARNING: declared typo never matched — ${t.note}`);
