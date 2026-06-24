/**
 * Phase-1 parity gate (see REFACTOR_PLAN.md §6).
 *
 * Proves the migrated convex-projective catalog reproduces the old sl3r family
 * EXACTLY: for every shared example id (and a sweep of live-d triangles) it
 * builds the action both ways — OLD (nested-matrix makeMat3Action on the old
 * data) vs NEW (flat makeMatrixAction on the migrated data) — and checks
 *   - the inverse[] permutation and shape match;
 *   - apply(g, ·) agrees on random vectors;
 *   - the proximal basepoint from γ agrees (so the picture is unchanged).
 *
 *   node scripts/parity/triangle-migration-parity.ts
 */

import { makeMatrixAction, asInvolutions, pairWithInverses } from '../../src/core/matrixAction.ts';
import { computeProximalBasepoint } from '../../src/core/orbit.ts';
import type { GroupAction } from '../../src/core/group.ts';

// NEW (migrated) catalog
import {
  EXAMPLES as NEW_EXAMPLES, makeLiveTri334 as newLiveTri, type MatrixGroupExample,
} from '../../src/examples/projective/triangle-groups/data.ts';

// OLD (to-be-retired) sl3r family
import { EXAMPLES as OLD_EXAMPLES, makeLiveTri334 as oldLiveTri } from '../../src/sl3r/examples.ts';
import { makeMat3Action } from '../../src/sl3r/action.ts';

const TOL = 1e-12;
let failures = 0;
let _s = 0xc0ffee >>> 0;
function rand(): number { _s = (_s * 1664525 + 1013904223) >>> 0; return _s / 0x100000000; }

function newAction(ex: MatrixGroupExample): GroupAction {
  return makeMatrixAction(ex.involutions ? asInvolutions(ex.generators) : pairWithInverses(ex.generators));
}

function compare(label: string, oldA: GroupAction, newA: GroupAction, gamma: readonly number[], powerIter: number): void {
  let bad = '';
  if (oldA.numGenerators !== newA.numGenerators || oldA.stateDim !== newA.stateDim) {
    bad = `shape old(${oldA.numGenerators},${oldA.stateDim}) new(${newA.numGenerators},${newA.stateDim})`;
  }
  const n = oldA.stateDim;
  let maxApply = 0;
  const oOut = new Float64Array(n), nOut = new Float64Array(n);
  for (let t = 0; t < 6 && !bad; t++) {
    const v = new Float64Array(n);
    for (let i = 0; i < n; i++) v[i] = 2 * rand() - 1;
    for (let g = 0; g < oldA.numGenerators; g++) {
      if (oldA.inverse[g] !== newA.inverse[g]) { bad = `inverse[${g}]`; break; }
      oldA.apply(g, v, 0, oOut, 0); newA.apply(g, v, 0, nOut, 0);
      for (let i = 0; i < n; i++) maxApply = Math.max(maxApply, Math.abs(oOut[i] - nOut[i]));
    }
  }
  // proximal basepoint agreement (the seed that fixes the picture)
  let maxSeed = 0;
  if (!bad) {
    const bo = computeProximalBasepoint(oldA, gamma, powerIter).basepoint;
    const bn = computeProximalBasepoint(newA, gamma, powerIter).basepoint;
    for (let i = 0; i < n; i++) maxSeed = Math.max(maxSeed, Math.abs(bo[i] - bn[i]));
  }
  const ok = !bad && maxApply <= TOL && maxSeed <= TOL;
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(24)} ${bad || `max|Δapply|=${maxApply.toExponential(2)}  max|Δseed|=${maxSeed.toExponential(2)}`}`);
}

// Shared catalog ids
for (const ex of NEW_EXAMPLES) {
  const old = OLD_EXAMPLES.find((e) => e.id === ex.id);
  if (!old) { console.log(`FAIL  ${ex.id}: missing in old EXAMPLES`); failures++; continue; }
  compare(ex.id, makeMat3Action(old.generators, { involutions: old.involutions }), newAction(ex), old.gamma, old.powerIter);
}

// Live-d triangle sweep
for (const d of [0.6, 0.9, 1.3, 1.8]) {
  const oldEx = oldLiveTri(d), newEx = newLiveTri(d);
  compare(`live-d=${d}`, makeMat3Action(oldEx.generators, { involutions: true }), newAction(newEx), oldEx.gamma, oldEx.powerIter);
}

console.log(failures === 0 ? `\nPhase-1 parity PASSED (tol ${TOL}).` : `\n${failures} FAILED.`);
process.exit(failures === 0 ? 0 : 1);
