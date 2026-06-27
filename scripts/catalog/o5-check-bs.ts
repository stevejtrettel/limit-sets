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
import { cyclotomicProduct } from '../../src/core/polynomial.ts';
import { companion, matInverse, matMul, matDet, type Mat } from '../../src/core/matrix.ts';
import { hypergeometricAction } from '../../src/examples/hypergeometric/recipe.ts';
import { findLoxodromicWord } from '../../src/core/seed.ts';

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

function isId(M: Mat, eps = 1e-9): boolean {
  for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) if (Math.abs(M[i * 5 + j] - (i === j ? 1 : 0)) > eps) return false;
  return true;
}

const rows = readFileSync(CSV, 'utf8').split('\n').slice(1).map(parseRow).filter(Boolean) as NonNullable<ReturnType<typeof parseRow>>[];
console.log(`parsed ${rows.length} rows`);

let badPoly = 0, badT = 0, badDet = 0, noLox = [] as number[];
for (const r of rows) {
  let f: number[], g: number[];
  try {
    f = cyclotomicProduct(r.alpha);
    g = cyclotomicProduct(r.beta);
  } catch (e) {
    console.log(`  #${r.number} (table ${r.table}): POLY FAIL — ${(e as Error).message}`);
    badPoly++; continue;
  }
  const A = companion(f), B = companion(g), T = matMul(B, matInverse(A));
  const tOk = isId(matMul(T, T));
  const dA = matDet(A), dB = matDet(B);
  const detOk = Math.abs(Math.abs(dA) - 1) < 1e-6 && Math.abs(Math.abs(dB) - 1) < 1e-6;
  if (!tOk) { console.log(`  #${r.number} (table ${r.table}): T² ≠ I`); badT++; }
  if (!detOk) { console.log(`  #${r.number} (table ${r.table}): det A=${dA.toFixed(3)} det B=${dB.toFixed(3)}`); badDet++; }
  const lox = findLoxodromicWord(hypergeometricAction(r.alpha, r.beta, 'free-product'));
  if (!lox) noLox.push(r.number);
}
console.log(`\npoly fails: ${badPoly}   T²≠I: ${badT}   det≠±1: ${badDet}`);
console.log(`no loxodromic word (expect = the 4 finite, Table 5 = #44–47): [${noLox.join(', ')}]`);
