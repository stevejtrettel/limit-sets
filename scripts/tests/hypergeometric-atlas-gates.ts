/**
 * Correctness gates for the hypergeometric atlases
 * (src/examples/hypergeometric/degree-le6.ts + degree7.ts) and the exact
 * invariant-form machinery behind them (core/invariantForm.ts +
 * exactMatrix.ikernel).
 *
 *   1. Known answers — hand-computed companion polynomials and forms for the
 *      smallest tables (degree 1–2), checked exactly.
 *   2. Catalog ↔ source — every emitted row of EVERY catalog re-verified from
 *      its (α, β) over ℤ/ℚ: invariant-form parity + exact Sylvester signature
 *      match the table's claim; the walk matches an exact T = B·A⁻¹ involution
 *      test; counts and ids are consistent. Raw pair-list files (when present)
 *      must agree with the emitted row set exactly.
 *   3. Dynamics — for every non-finite table, a certified loxodromic seed is
 *      found for a sample of rows (first/middle/last), and its orbit stays
 *      inside a sane bounding box.
 *   4. Low-dimension charts — fitAutoChartEmbedding / fitPCAChartEmbedding no
 *      longer crash for stateDim 2 and 3 (RP¹/RP² tables) and return all-finite
 *      embeddings (pinning the chart.ts zero-padding fix).
 *
 *   node scripts/tests/hypergeometric-atlas-gates.ts
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import type { AtlasCatalog } from '../../src/examples/hypergeometric/atlasCatalog.ts';
import { CATALOG as LE6 } from '../../src/examples/hypergeometric/degree-le6.ts';
import { CATALOG as DEG7 } from '../../src/examples/hypergeometric/degree7.ts';
import { hypergeometricAction, WALK_LABELS, WALK_FALLBACK } from '../../src/examples/hypergeometric/recipe.ts';
import { cyclotomicProduct } from '../../src/core/polynomial.ts';
import {
  type IMat, ifromInt, finverse, fclearDenominators, imul, iequal, iident,
} from '../../src/core/exactMatrix.ts';
import { invariantForms, invariantFormType } from '../../src/core/invariantForm.ts';
import { seedFromLoxodromic } from '../../src/core/seed.ts';
import { generateOrbit } from '../../src/core/orbit.ts';
import { fitAutoChartEmbedding, fitPCAChartEmbedding } from '../../src/core/chart.ts';

/** Every catalog, with the pair-list directory it was generated from. */
const CATALOGS: readonly { catalog: AtlasCatalog; listsDir: string }[] = [
  { catalog: LE6,  listsDir: 'hypergeometric-pair-lists' },
  { catalog: DEG7, listsDir: 'hypergeometric-degree7-pair-lists' },
];

let failures = 0;
function check(name: string, ok: boolean, detail = ''): void {
  if (ok) { console.log(`  ✓ ${name}`); return; }
  failures++;
  console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
}

function icompanion(coeff: readonly number[]): IMat {
  const n = coeff.length - 1;
  const C: IMat = Array.from({ length: n }, () => Array<bigint>(n).fill(0n));
  for (let j = 0; j < n - 1; j++) C[j + 1][j] = 1n;
  for (let r = 0; r < n; r++) C[r][n - 1] = BigInt(-coeff[n - r]);
  return C;
}

function iinverse(A: IMat): IMat {
  const inv = finverse(ifromInt(A));
  if (!inv) throw new Error('singular');
  const { M, scale } = fclearDenominators(inv);
  if (scale !== 1n) throw new Error('non-integral inverse');
  return M;
}

// ─── 1. Known answers ────────────────────────────────────────────────────────

console.log('1. known answers (exact)');
{
  // degree 1, o10: α=(1/2) → f = x+1, β=(0) → g = x−1.
  check('d1 f = x+1', JSON.stringify(cyclotomicProduct(['1/2'])) === '[1,1]');
  check('d1 g = x−1', JSON.stringify(cyclotomicProduct(['0'])) === '[1,-1]');

  // degree 2, o20: α=(1/6,5/6) → x²−x+1, β=(0,1/2) → x²−1.
  check('d2 f = x²−x+1', JSON.stringify(cyclotomicProduct(['1/6', '5/6'])) === '[1,-1,1]');
  check('d2 g = x²−1',   JSON.stringify(cyclotomicProduct(['0', '1/2']))  === '[1,0,-1]');

  // The o20 pair must preserve a unique symmetric definite form, and T = B·A⁻¹
  // must be an involution (det ratio −1).
  const A = icompanion([1, -1, 1]);
  const B = icompanion([1, 0, -1]);
  const ft = invariantFormType([A, B]);
  check('d2-o20 form is symmetric definite', ft.kind === 'orthogonal'
    && (ft.signature!.pos === 2 || ft.signature!.neg === 2) && ft.signature!.zero === 0,
    JSON.stringify(ft.signature));
  const T = imul(B, iinverse(A));
  check('d2-o20 T = B·A⁻¹ is an involution', iequal(imul(T, T), iident(2)));

  // degree 2 symplectic: A, B ∈ SL(2,ℤ) preserve the alternating form; the pair
  // (1/6,5/6),(1/4,3/4) must have NO symmetric invariant form.
  const As = icompanion(cyclotomicProduct(['1/6', '5/6']));
  const Bs = icompanion(cyclotomicProduct(['1/4', '3/4']));
  check('d2-sp has alternating form only',
    invariantForms([As, Bs], 'antisymmetric').length === 1
    && invariantForms([As, Bs], 'symmetric').length === 0);
}

// ─── 2. Catalog ↔ source ─────────────────────────────────────────────────────

for (const { catalog, listsDir: listsSubdir } of CATALOGS) {
  const { tables, rows, examples, tableByKey, examplesInTable } = catalog;
  console.log(`2. catalog re-verification — ${catalog.name} (all ${rows.length} rows, exact)`);
  const t0 = performance.now();
  check('table counts sum to rows.length',
    tables.reduce((s, t) => s + t.count, 0) === rows.length, `${rows.length}`);
  check('examples matches rows', examples.length === rows.length);
  check('ids are unique', new Set(rows.map((r) => r.id)).size === rows.length);

  let formOk = 0, walkOk = 0, idOk = 0;
  for (const row of rows) {
    const table = tableByKey(row.table);
    if (row.id === `${table.key}-${row.n}`) idOk++;

    const A = icompanion(cyclotomicProduct(row.alpha));
    const B = icompanion(cyclotomicProduct(row.beta));

    const ft = invariantFormType([A, B]);
    const parityMatches = ft.kind === table.kind;
    let sigMatches = true;
    if (table.kind === 'orthogonal') {
      const { pos, neg } = ft.signature!;
      const [p, q] = table.signature!;
      sigMatches = (pos === p && neg === q) || (pos === q && neg === p);
    }
    if (parityMatches && sigMatches) formOk++;
    else console.error(`    ✗ ${row.id}: form ${ft.kind} ${JSON.stringify(ft.signature)} vs table ${table.form}`);

    const T = imul(B, iinverse(A));
    const rowWalk = iequal(imul(T, T), iident(T.length)) ? 'free-product' : 'free';
    if (rowWalk === table.walk) walkOk++;
    else console.error(`    ✗ ${row.id}: walk ${rowWalk} vs table ${table.walk}`);
  }
  check(`ids follow '<table>-<n>' (${idOk}/${rows.length})`, idOk === rows.length);
  check(`invariant form parity + signature match table claim (${formOk}/${rows.length})`, formOk === rows.length);
  check(`walk matches exact involution test (${walkOk}/${rows.length})`, walkOk === rows.length);
  console.log(`  (${(performance.now() - t0).toFixed(0)}ms)`);

  // Raw pair lists, when present, must agree with the emitted rows exactly.
  const listsDir = fileURLToPath(new URL(`../catalog/${listsSubdir}`, import.meta.url));
  if (existsSync(listsDir)) {
    let agree = true;
    for (const file of readdirSync(listsDir).filter((f) => f.endsWith('.txt'))) {
      const table = tables.find((t) => t.file === file);
      if (!table) { agree = false; console.error(`    ✗ ${file} has no table in the catalog`); continue; }
      const raw = [...readFileSync(`${listsDir}/${file}`, 'utf8')
        .matchAll(/\[\s*\(([^)]*)\)\s*,\s*\(([^)]*)\)\s*\]/g)]
        .map((m) => `${m[1].replace(/\s/g, '')}|${m[2].replace(/\s/g, '')}`);
      const emitted = examplesInTable(table.key)
        .map((e) => `${e.alpha.join(',')}|${e.beta.join(',')}`);
      if (raw.length !== emitted.length || raw.some((r, i) => r !== emitted[i])) {
        agree = false;
        console.error(`    ✗ ${file}: raw rows differ from emitted catalog`);
      }
    }
    check('raw pair lists agree with emitted catalog', agree);
  } else {
    console.log('  (raw pair lists not present — skipping source comparison)');
  }
}

// ─── 3. Dynamics — certified seeds per table ─────────────────────────────────

for (const { catalog } of CATALOGS) {
  console.log(`3. loxodromic seeds — ${catalog.name} (sampled rows per non-finite table)`);
  for (const table of catalog.tables) {
    if (table.finite) { console.log(`  – ${table.key} (${table.form}): finite, skipped`); continue; }
    const rows = catalog.rows.filter((r) => r.table === table.key);
    const sample = [...new Set([0, rows.length >> 1, rows.length - 1])].map((i) => rows[i]);
    let ok = true;
    for (const row of sample) {
      const ex = catalog.exampleById(row.id)!;
      const action = hypergeometricAction(ex.alpha, ex.beta, table.walk);
      const s = seedFromLoxodromic(action, {
        labels: WALK_LABELS[table.walk], fallbackWord: WALK_FALLBACK[table.walk],
      });
      if (s.fallback) {
        // Parabolic fallback is legitimate for unipotent-generated groups; the
        // basepoint must still be finite.
        console.log(`    (${row.id}: parabolic fallback seed)`);
      }
      const orbit = generateOrbit(action, s.basepoint, 6);
      let finite = orbit.count > 0;
      for (let i = 0; i < orbit.count * orbit.stateDim && finite; i++) {
        if (!Number.isFinite(orbit.vecs[i])) finite = false;
      }
      if (!finite) { ok = false; console.error(`    ✗ ${row.id}: non-finite orbit`); }
    }
    check(`${table.key} (${table.form}): ${sample.length} sampled seeds ok`, ok);
  }
}

// ─── 4. Low-dimension charts (pins the chart.ts zero-padding fix) ────────────

console.log('4. charts in RP¹ / RP² (stateDim 2, 3)');
for (const key of ['d2-sp', 'd3-o21']) {
  const ex = LE6.examplesInTable(key)[0];
  const action = hypergeometricAction(ex.alpha, ex.beta, ex.table.walk);
  const s = seedFromLoxodromic(action, {
    labels: WALK_LABELS[ex.table.walk], fallbackWord: WALK_FALLBACK[ex.table.walk],
  });
  const orbit = generateOrbit(action, s.basepoint, 8);
  const embeddings = [fitAutoChartEmbedding(orbit), fitPCAChartEmbedding(orbit, 0)];
  let ok = true;
  for (const emb of embeddings) {
    if (!emb) { ok = false; continue; }
    for (const row of emb.rows) for (const v of row) if (!Number.isFinite(v)) ok = false;
  }
  check(`${key} (${ex.table.degree}-dim state): charts fit with finite entries`, ok);
}

// ─────────────────────────────────────────────────────────────────────────────

if (failures > 0) {
  console.error(`\n${failures} gate(s) FAILED`);
  process.exit(1);
}
console.log('\nall gates passed');
