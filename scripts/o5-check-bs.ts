/**
 * Validate the full Bajpai–Singh degree-5 catalog (orthogonal_hypergeometric_
 * group_tables.csv, all 77 groups) before building anything from it.
 *
 * Checks per row: polynomials parse (conjugate-closed), T = BA⁻¹ is an
 * involution (the {T,B} action's core assumption), det A/B = ±1, and whether a
 * loxodromic seed word exists (thin/arithmetic should have one; finite groups,
 * Table 5, should NOT). Run: node scripts/o5-check-bs.ts
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { polynomialFromRotationStrings } from '../src/sp6/hypergeometric.ts';
import { makeO5Action, buildO5Matrices, mul5, type Mat5 } from '../src/o5/action.ts';
import { findLoxodromicWord } from '../src/core/loxodromic.ts';

const CSV = fileURLToPath(new URL('./orthogonal_hypergeometric_group_tables.csv', import.meta.url));

function parseTuple(s: string): string[] {
  return s.replace(/[()"]/g, '').split(',').map((x) => x.trim()).filter(Boolean);
}
// CSV: table,number,"(a,...)","(b,...)" — split respecting quotes.
function parseRow(line: string): { table: number; number: number; alpha: string[]; beta: string[] } | null {
  const m = line.match(/^(\d+),(\d+),"([^"]*)","([^"]*)"\s*$/);
  if (!m) return null;
  return { table: +m[1], number: +m[2], alpha: parseTuple(m[3]), beta: parseTuple(m[4]) };
}

function det5(M: Mat5): number {
  const sub = (rows: number[], cols: number[]): number => {
    if (rows.length === 1) return M[rows[0] * 5 + cols[0]];
    let s = 0;
    for (let j = 0; j < cols.length; j++) s += (j % 2 ? -1 : 1) * M[rows[0] * 5 + cols[j]] * sub(rows.slice(1), cols.filter((_, t) => t !== j));
    return s;
  };
  return sub([0, 1, 2, 3, 4], [0, 1, 2, 3, 4]);
}
function isId(M: Mat5, eps = 1e-9): boolean {
  for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) if (Math.abs(M[i * 5 + j] - (i === j ? 1 : 0)) > eps) return false;
  return true;
}

const rows = readFileSync(CSV, 'utf8').split('\n').slice(1).map(parseRow).filter(Boolean) as NonNullable<ReturnType<typeof parseRow>>[];
console.log(`parsed ${rows.length} rows`);

let badPoly = 0, badT = 0, badDet = 0, noLox = [] as number[];
for (const r of rows) {
  let f: number[], g: number[];
  try {
    f = polynomialFromRotationStrings(r.alpha);
    g = polynomialFromRotationStrings(r.beta);
  } catch (e) {
    console.log(`  #${r.number} (table ${r.table}): POLY FAIL — ${(e as Error).message}`);
    badPoly++; continue;
  }
  const { A, B, T } = buildO5Matrices(f, g);
  const tOk = isId(mul5(T, T));
  const dA = det5(A), dB = det5(B);
  const detOk = Math.abs(Math.abs(dA) - 1) < 1e-6 && Math.abs(Math.abs(dB) - 1) < 1e-6;
  if (!tOk) { console.log(`  #${r.number} (table ${r.table}): T² ≠ I`); badT++; }
  if (!detOk) { console.log(`  #${r.number} (table ${r.table}): det A=${dA.toFixed(3)} det B=${dB.toFixed(3)}`); badDet++; }
  const lox = findLoxodromicWord(makeO5Action(f, g));
  if (!lox) noLox.push(r.number);
}
console.log(`\npoly fails: ${badPoly}   T²≠I: ${badT}   det≠±1: ${badDet}`);
console.log(`no loxodromic word (expect = the 4 finite, Table 5 = #44–47): [${noLox.join(', ')}]`);
