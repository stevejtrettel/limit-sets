/**
 * Phase-2b parity gate (see REFACTOR_PLAN.md §6).
 *
 * Proves the new degree-6 symplectic module reproduces the old sp6 family
 * EXACTLY, for the full 88-row catalog AND the 6 curated examples:
 *   - coefflistf/g match (integer-exact);
 *   - action apply(g,·) agrees (new symplecticAction vs old makeSp6Action);
 *   - the γ-power-iterated basepoint agrees (pictures unchanged).
 *
 *   node scripts/parity/hypergeometric-sp6-parity.ts
 */

import {
  CATALOG_EXAMPLES as NEW_CAT, EXAMPLES as NEW_CUR, symplecticAction, type SymplecticExample,
} from '../../src/examples/hypergeometric/degree6-symplectic.ts';
import { computeProximalBasepoint } from '../../src/core/orbit.ts';
import type { GroupAction } from '../../src/core/group.ts';

import { CATALOG_EXAMPLES as OLD_CAT } from '../../src/sp6/catalog.ts';
import { EXAMPLES as OLD_CUR } from '../../src/sp6/examples.ts';
import { makeSp6Action } from '../../src/sp6/action.ts';
import type { Sp6Example } from '../../src/sp6/examples.ts';

const TOL = 1e-12;
let failures = 0;
let _s = 0x59c6 >>> 0;
function rand(): number { _s = (_s * 1664525 + 1013904223) >>> 0; return _s / 0x100000000; }

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
const intEq = (x: readonly number[], y: readonly number[]): boolean =>
  x.length === y.length && x.every((v, i) => v === y[i]);

function check(tag: string, newList: readonly SymplecticExample[], oldList: readonly Sp6Example[]): void {
  const oldById = new Map(oldList.map((e) => [e.id, e]));
  let wPoly = 0, wApply = 0, wSeed = 0, n = 0;
  for (const ex of newList) {
    const old = oldById.get(ex.id);
    if (!old) { console.log(`FAIL ${tag} ${ex.id}: missing in old`); failures++; continue; }
    n++;
    if (!intEq(ex.coefflistf, old.coefflistf) || !intEq(ex.coefflistg, old.coefflistg)) {
      console.log(`FAIL ${tag} ${ex.id}: coefflist mismatch`); failures++; wPoly++; continue;
    }
    const na = symplecticAction(ex), oa = makeSp6Action(old);
    const dA = applyMax(oa, na); wApply = Math.max(wApply, dA);
    const bo = computeProximalBasepoint(oa, old.gamma, old.powerIter).basepoint;
    const bn = computeProximalBasepoint(na, ex.gamma, ex.powerIter).basepoint;
    let dS = 0; for (let i = 0; i < na.stateDim; i++) dS = Math.max(dS, Math.abs(bo[i] - bn[i]));
    wSeed = Math.max(wSeed, dS);
    if (dA > TOL || dS > TOL) { console.log(`FAIL ${tag} ${ex.id}: apply ${dA.toExponential(2)} seed ${dS.toExponential(2)}`); failures++; }
  }
  console.log(`${tag}: ${n} groups · coefflist exact: ${wPoly === 0 ? 'yes' : 'NO'} · worst |Δapply|=${wApply.toExponential(2)} |Δseed|=${wSeed.toExponential(2)}`);
}

check('catalog', NEW_CAT, OLD_CAT);
check('curated', NEW_CUR, OLD_CUR);

console.log(failures === 0 ? `\nPhase-2b parity PASSED (tol ${TOL}).` : `\n${failures} FAILED.`);
process.exit(failures === 0 ? 0 : 1);
