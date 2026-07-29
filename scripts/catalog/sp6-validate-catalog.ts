/**
 * Correctness gate for the full 458-group BDSS degree-6 symplectic atlas.
 *
 *   node scripts/catalog/sp6-validate-catalog.ts
 *
 * Three layers, cheapest first:
 *
 *   1. STRUCTURAL — every (α, β) yields a degree-6 integer palindromic companion
 *      polynomial with unit leading/constant term (shared `validateAllSymplectic`).
 *      This is what catches a mistyped or non-conjugate-closed rotation tuple.
 *   2. JOIN — the BDN catalog (88 groups) must embed in the BDSS atlas exactly:
 *      every BDN group found, statuses agreeing where both speak, and the BDSS
 *      Table A rows reproducing BDN Table 1 row for row.
 *   3. COUNTS — the paper's own arithmetic: 40 + 143 + 211 + 64 = 458, and the
 *      status tally decomposing the way the two papers' claims require.
 *
 * The structural layer also auto-seeds each group (power iteration on a certified
 * loxodromic word), so this doubles as the answer to "can the renderer find a
 * basepoint for all 458?" — warnings, not failures, for the ones it cannot.
 */
import { CATALOG_EXAMPLES as BDSS, CORRECTED, ROWS, bdssGroupKey } from '../../src/examples/hypergeometric/degree6-symplectic-bdss.ts';
import { CATALOG_EXAMPLES as BDN } from '../../src/examples/hypergeometric/degree6-symplectic.ts';
import { validateAllSymplectic } from '../../src/examples/hypergeometric/validate.ts';
import { cyclotomicProduct } from '../../src/core/polynomial.ts';

let failures = 0;
const fail = (msg: string) => { console.error(`  FAIL  ${msg}`); failures++; };
const pass = (msg: string) => console.log(`  ok    ${msg}`);

// ─── 3. Counts ──────────────────────────────────────────────────────────────

console.log('\ncounts');
const EXPECTED_ROWS = { A: 40, B: 143, C: 211, D: 64 } as const;
const byTable = { A: 0, B: 0, C: 0, D: 0 };
for (const r of ROWS) byTable[r.table]++;
for (const t of ['A', 'B', 'C', 'D'] as const) {
  if (byTable[t] === EXPECTED_ROWS[t]) pass(`Table ${t}: ${byTable[t]} rows`);
  else fail(`Table ${t}: ${byTable[t]} rows, paper says ${EXPECTED_ROWS[t]}`);
}
if (BDSS.length === 458) pass('458 groups total'); else fail(`${BDSS.length} groups, expected 458`);

const byStatus = BDSS.reduce<Record<string, number>>((m, e) => ((m[e.status] = (m[e.status] ?? 0) + 1), m), {});
console.log(`  info  status: ${Object.entries(byStatus).map(([s, n]) => `${n} ${s}`).join(', ')}`);

// Arithmetic must decompose as Tables B + C (permanent) plus whatever BDN proved
// arithmetic among the Table A rows.
const bdnArith = BDN.filter((e) => e.status === 'arithmetic').length;
const expectArith = EXPECTED_ROWS.B + EXPECTED_ROWS.C + bdnArith;
if (byStatus.arithmetic === expectArith) pass(`arithmetic = ${EXPECTED_ROWS.B} (B) + ${EXPECTED_ROWS.C} (C) + ${bdnArith} (BDN) = ${expectArith}`);
else fail(`arithmetic = ${byStatus.arithmetic}, expected ${expectArith}`);

const bdnThin = BDN.filter((e) => e.status === 'thin').length;
if (byStatus.thin === bdnThin) pass(`thin = ${bdnThin}, all from the BDN join`);
else fail(`thin = ${byStatus.thin}, expected ${bdnThin} (BDN's thin count)`);

const bdnOpen = BDN.filter((e) => e.status === 'open').length;
if (byStatus.open === bdnOpen) pass(`open = ${bdnOpen} (C-32, C-47, C-55)`);
else fail(`open = ${byStatus.open}, expected ${bdnOpen}`);

// ─── 2. Join against the BDN catalog ────────────────────────────────────────

console.log('\njoin against the BDN catalog (88 groups)');
const bdssByKey = new Map(BDSS.map((e) => [bdssGroupKey(e.alpha, e.beta), e]));
if (bdssByKey.size === BDSS.length) pass('all 458 (α, β) keys distinct');
else fail(`${BDSS.length - bdssByKey.size} duplicate (α, β) keys`);

const missing: string[] = [];
const disagreeing: string[] = [];
for (const b of BDN) {
  const hit = bdssByKey.get(bdssGroupKey(b.alpha, b.beta));
  if (!hit) { missing.push(b.label); continue; }
  if (hit.bdnLabel !== b.label) disagreeing.push(`${b.label} joined as ${hit.bdnLabel ?? 'unlabelled'}`);
  else if (hit.status !== b.status) disagreeing.push(`${b.label}: BDSS says ${hit.status}, BDN says ${b.status}`);
}
if (missing.length === 0) pass(`all ${BDN.length} BDN groups found in the BDSS atlas`);
else fail(`${missing.length} BDN groups absent from BDSS: ${missing.join(', ')}`);
if (disagreeing.length === 0) pass('every joined group agrees on label and status');
else for (const d of disagreeing) fail(d);

const labelled = BDSS.filter((e) => e.bdnLabel).length;
if (labelled === BDN.length) pass(`${labelled} BDSS rows carry a BDN label`);
else fail(`${labelled} BDSS rows carry a BDN label, expected ${BDN.length}`);

// BDSS Table A is BDN Table 1, in the same order — the parser's tightest gate.
const tableA = BDSS.filter((e) => e.table === 'A');
const bdnTable1 = BDN.filter((e) => e.label.startsWith('A-'));
const aMismatch = tableA.findIndex((e, i) => e.bdnLabel !== bdnTable1[i]?.label);
if (tableA.length === bdnTable1.length && aMismatch === -1) pass(`Table A reproduces BDN Table 1 row for row (${tableA.length} rows)`);
else fail(`Table A diverges from BDN Table 1 at row ${aMismatch + 1}`);

// The honestly-unknown residue: Table D rows the BDN tables do not reach.
const unknown = BDSS.filter((e) => e.status === 'unknown');
console.log(`  info  ${unknown.length} Table-D rows left 'unknown' (open in 2020, not covered by BDN):`);
console.log(`        ${unknown.map((e) => `D-${e.row}`).join(', ')}`);

// ─── Corrected rows: every edit was both necessary and sufficient ───────────
// Each corrected row records what the paper PRINTED as well as what we read it
// as. That makes the edit checkable here rather than only by eye: the printed
// tuple must genuinely fail to be conjugate-closed (otherwise we changed
// something that was fine), and the tuple we stored must succeed.

console.log('\ncorrected rows (typos in the printed paper)');
const closed = (t: readonly string[]) => { try { cyclotomicProduct(t); return true; } catch { return false; } };
const NOTE = /^([αβ]) printed \(([^)]*)\) — read as \(([^)]*)\)$/;

console.log(`  info  ${CORRECTED.length} of 458 rows carry a correction`);
for (const e of CORRECTED) {
  for (const note of e.corrected!.split('; ')) {
    const m = note.match(NOTE);
    if (!m) { fail(`${e.label}: unparseable correction note ${JSON.stringify(note)}`); continue; }
    const [, slot, printedStr, readStr] = m;
    const printed = printedStr.split(',');
    const read = readStr.split(',');
    const stored = slot === 'α' ? e.alpha : e.beta;

    if (closed(printed)) fail(`${e.label} ${slot}: printed tuple (${printedStr}) IS conjugate-closed — nothing needed correcting`);
    if (!closed(read)) fail(`${e.label} ${slot}: corrected tuple (${readStr}) is still not conjugate-closed`);
    if (read.join(',') !== stored.join(',')) fail(`${e.label} ${slot}: note says (${readStr}) but the row stores (${stored.join(',')})`);
  }
}
if (failures === 0) pass('every correction: printed tuple invalid, stored tuple valid, note matches the row');
for (const e of CORRECTED) console.log(`        ${e.label.padEnd(12)} ${e.corrected}`);

// ─── 1. Structural (+ auto-seed) ────────────────────────────────────────────

console.log('\nstructural: integer palindromic degree-6 companion pair, and auto-seeding');
const results = validateAllSymplectic(BDSS);
const bad = results.filter((r) => !r.passed);
if (bad.length === 0) pass(`all ${results.length} groups yield a valid symplectic companion pair`);
else for (const r of bad) fail(`${r.example.label}: ${r.errors.join('; ')}`);

const warned = results.filter((r) => r.warnings.length > 0);
if (warned.length === 0) {
  pass('every group auto-seeded to a certified loxodromic basepoint');
} else {
  console.log(`  warn  ${warned.length}/${results.length} groups had seeding warnings (browsable, but not figure-grade):`);
  for (const r of warned) console.log(`        ${r.example.label}: ${r.warnings.join('; ')}`);
}

console.log(failures === 0 ? '\nPASS\n' : `\nFAIL — ${failures} problem(s)\n`);
process.exit(failures === 0 ? 0 : 1);
