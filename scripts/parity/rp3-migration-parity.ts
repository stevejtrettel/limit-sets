/**
 * Phase-3 parity gate (see REFACTOR_PLAN.md §6).
 *
 * Proves the migrated RP³ pair catalog reproduces the old sl4r family exactly:
 * for each example, the new flat-matrix `makeMatrixAction` agrees with the old
 * nested-matrix `makeMat4Action` on apply(g,·) and on the γ-seeded basepoint.
 *
 *   node scripts/parity/rp3-migration-parity.ts
 */

import { makeMatrixAction, asInvolutions, pairWithInverses } from '../../src/core/matrixAction.ts';
import { computeProximalBasepoint } from '../../src/core/orbit.ts';
import { type Mat, matDim } from '../../src/core/matrix.ts';
import type { GroupAction } from '../../src/core/group.ts';

import { EXAMPLES } from '../../src/examples/projective/rp3-pairs/data.ts';
import { makeMat4Action, type Mat4R } from '../../src/sl4r/action.ts';

const TOL = 1e-12;
let failures = 0;
let _s = 0x4444 >>> 0;
function rand(): number { _s = (_s * 1664525 + 1013904223) >>> 0; return _s / 0x100000000; }

/** flat 4×4 Mat → nested Mat4R for the old factory. */
function toNested(M: Mat): Mat4R {
  const n = matDim(M);
  const rows: number[][] = [];
  for (let r = 0; r < n; r++) rows.push(Array.from(M.subarray(r * n, r * n + n)));
  return rows as unknown as Mat4R;
}

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

for (const ex of EXAMPLES) {
  const newA = makeMatrixAction(ex.involutions ? asInvolutions(ex.generators) : pairWithInverses(ex.generators));
  const oldA = makeMat4Action(ex.generators.map(toNested), { involutions: ex.involutions });

  let bad = '';
  if (newA.numGenerators !== oldA.numGenerators || newA.stateDim !== oldA.stateDim) bad = 'shape';
  for (let g = 0; g < newA.numGenerators && !bad; g++) if (newA.inverse[g] !== oldA.inverse[g]) bad = `inverse[${g}]`;

  const dA = bad ? NaN : applyMax(oldA, newA);
  // Seed both with the old fixed γ = B (NEW no longer carries γ — it auto-seeds at runtime).
  const bo = computeProximalBasepoint(oldA, [2], 80).basepoint;
  const bn = computeProximalBasepoint(newA, [2], 80).basepoint;
  let dS = 0; for (let i = 0; i < newA.stateDim; i++) dS = Math.max(dS, Math.abs(bo[i] - bn[i]));

  const ok = !bad && dA <= TOL && dS <= TOL;
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${ex.id.padEnd(8)} ${bad || `max|Δapply|=${dA.toExponential(2)}  max|Δseed|=${dS.toExponential(2)}`}`);
}

console.log(failures === 0 ? `\nPhase-3 parity PASSED (tol ${TOL}).` : `\n${failures} FAILED.`);
process.exit(failures === 0 ? 0 : 1);
