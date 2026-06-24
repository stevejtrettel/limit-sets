/**
 * Phase-4 parity gate (see REFACTOR_PLAN.md §6).
 *
 * Proves the relocated kleinian (Möbius) family reproduces the old sl2c exactly:
 * for each of the 7 examples, the new makeMobiusAction agrees with the old one
 * on apply(g,·) and on the γ-seeded basepoint. (The only code change was
 * swapping the local normalizeS3 for the identical core normalizeSphere.)
 *
 *   node scripts/parity/kleinian-migration-parity.ts
 */

import { makeMobiusAction as newAction } from '../../src/examples/kleinian/action.ts';
import { EXAMPLES as NEW } from '../../src/examples/kleinian/examples.ts';
import { makeMobiusAction as oldAction } from '../../src/sl2c/action.ts';
import { EXAMPLES as OLD } from '../../src/sl2c/examples.ts';
import { computeProximalBasepoint } from '../../src/core/orbit.ts';
import type { GroupAction } from '../../src/core/group.ts';

const TOL = 1e-12;
let failures = 0;
let _s = 0x2c2c >>> 0;
function rand(): number { _s = (_s * 1664525 + 1013904223) >>> 0; return _s / 0x100000000; }

function applyMax(a: GroupAction, b: GroupAction): number {
  const n = a.stateDim;
  let m = 0;
  const oa = new Float64Array(n), ob = new Float64Array(n);
  for (let t = 0; t < 6; t++) {
    const v = new Float64Array(n);
    for (let i = 0; i < n; i++) v[i] = 2 * rand() - 1;
    for (let g = 0; g < a.numGenerators; g++) {
      a.apply(g, v, 0, oa, 0); b.apply(g, v, 0, ob, 0);
      for (let i = 0; i < n; i++) m = Math.max(m, Math.abs(oa[i] - ob[i]));
    }
  }
  return m;
}

const oldById = new Map(OLD.map((e) => [e.id, e]));
for (const ex of NEW) {
  const old = oldById.get(ex.id);
  if (!old) { console.log(`FAIL ${ex.id}: missing in old`); failures++; continue; }
  const na = newAction(ex.generators), oa = oldAction(old.generators);
  const dA = applyMax(oa, na);
  // Seed both with OLD's hand γ (NEW no longer carries γ — it auto-seeds at runtime).
  const bo = computeProximalBasepoint(oa, old.gamma, old.powerIter).basepoint;
  const bn = computeProximalBasepoint(na, old.gamma, old.powerIter).basepoint;
  let dS = 0; for (let i = 0; i < na.stateDim; i++) dS = Math.max(dS, Math.abs(bo[i] - bn[i]));
  const ok = dA <= TOL && dS <= TOL;
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${ex.id.padEnd(20)} max|Δapply|=${dA.toExponential(2)}  max|Δseed|=${dS.toExponential(2)}`);
}

console.log(failures === 0 ? `\nPhase-4 parity PASSED for all ${NEW.length} groups (tol ${TOL}).` : `\n${failures} FAILED.`);
process.exit(failures === 0 ? 0 : 1);
