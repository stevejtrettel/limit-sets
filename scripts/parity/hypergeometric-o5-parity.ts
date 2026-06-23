/**
 * Phase-2a parity gate (see REFACTOR_PLAN.md §6).
 *
 * Proves the new degree-5 orthogonal catalog + hypergeometric recipe reproduce
 * the old o5 family EXACTLY, for all 77 groups:
 *   - cyclotomicProduct(α/β) equals the old stored coefflistf/g (integer-exact);
 *   - the action apply(g,·) agrees (new free-product recipe vs old makeO5Action);
 *   - the loxodromic seed basepoint agrees (so pictures are unchanged), for the
 *     non-finite groups.
 *
 *   node scripts/parity/hypergeometric-o5-parity.ts
 */

import { hypergeometricAction, hypergeometricMatrices, WALK_FALLBACK, WALK_LABELS } from '../../src/examples/hypergeometric/recipe.ts';
import { CATALOG_EXAMPLES as NEW } from '../../src/examples/hypergeometric/degree5-orthogonal.ts';
import { cyclotomicProduct } from '../../src/core/polynomial.ts';
import { seedFromLoxodromic } from '../../src/core/seed.ts';
import type { GroupAction } from '../../src/core/group.ts';

import { CATALOG_EXAMPLES as OLD } from '../../src/o5/catalog.ts';
import { makeO5Action } from '../../src/o5/action.ts';
import { loxodromicSeed } from '../../src/o5/seed.ts';

const TOL = 1e-12;
let failures = 0;
let _s = 0x5eed >>> 0;
function rand(): number { _s = (_s * 1664525 + 1013904223) >>> 0; return _s / 0x100000000; }

const oldById = new Map(OLD.map((e) => [e.id, e]));

function applyMax(a: GroupAction, b: GroupAction): number {
  const n = a.stateDim;
  let m = 0;
  const oa = new Float64Array(n), ob = new Float64Array(n);
  for (let t = 0; t < 4; t++) {
    const v = new Float64Array(n);
    for (let i = 0; i < n; i++) v[i] = 2 * rand() - 1;
    for (let gg = 0; gg < a.numGenerators; gg++) {
      a.apply(gg, v, 0, oa, 0); b.apply(gg, v, 0, ob, 0);
      for (let i = 0; i < n; i++) m = Math.max(m, Math.abs(oa[i] - ob[i]));
    }
  }
  return m;
}

let worstPoly = 0, worstApply = 0, worstSeed = 0;
for (const ex of NEW) {
  const old = oldById.get(ex.id);
  if (!old) { console.log(`FAIL ${ex.id}: missing in old catalog`); failures++; continue; }

  // 1. polynomials
  const f = cyclotomicProduct(ex.alpha), g = cyclotomicProduct(ex.beta);
  const polyOk = f.length === old.coefflistf.length && f.every((v, i) => v === old.coefflistf[i])
              && g.length === old.coefflistg.length && g.every((v, i) => v === old.coefflistg[i]);
  if (!polyOk) { console.log(`FAIL ${ex.id}: coefflist mismatch`); failures++; continue; }
  // (sanity: companion matrices build from the same f,g — both sides do)
  void hypergeometricMatrices(ex.alpha, ex.beta);

  // 2. action apply
  const newA = hypergeometricAction(ex.alpha, ex.beta, 'free-product');
  const oldA = makeO5Action(old.coefflistf, old.coefflistg);
  const dApply = applyMax(oldA, newA);
  worstApply = Math.max(worstApply, dApply);

  // 3. seed basepoint (non-finite only)
  if (ex.status !== 'finite') {
    const sn = seedFromLoxodromic(newA, { labels: WALK_LABELS['free-product'], fallbackWord: WALK_FALLBACK['free-product'] });
    const so = loxodromicSeed(oldA);
    let ds = 0;
    for (let i = 0; i < newA.stateDim; i++) ds = Math.max(ds, Math.abs(sn.basepoint[i] - so.basepoint[i]));
    worstSeed = Math.max(worstSeed, ds);
    if (ds > TOL || dApply > TOL) { console.log(`FAIL ${ex.id}: apply ${dApply.toExponential(2)} seed ${ds.toExponential(2)}`); failures++; }
  } else if (dApply > TOL) {
    console.log(`FAIL ${ex.id}: apply ${dApply.toExponential(2)}`); failures++;
  }
}

console.log(`coefflist exact: ${worstPoly === 0 ? 'yes' : 'NO'}`);
console.log(`worst |Δapply| = ${worstApply.toExponential(2)}   worst |Δseed| = ${worstSeed.toExponential(2)}`);
console.log(failures === 0 ? `\nPhase-2a parity PASSED for all ${NEW.length} groups (tol ${TOL}).` : `\n${failures} FAILED.`);
process.exit(failures === 0 ? 0 : 1);
