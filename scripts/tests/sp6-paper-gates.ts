/**
 * Gates for the paper figure set (src/examples/hypergeometric/paperFigures.ts).
 *
 *   node scripts/tests/sp6-paper-gates.ts
 *
 * FIGURES is meant to be edited as you curate, so these checks guard the two
 * claims the paper makes about it:
 *
 *   1. Every figure resolves to a real group and yields a valid degree-6
 *      symplectic companion pair.
 *   2. γ = TBT — the word §5 names — is loxodromic for EVERY figure, with
 *      spectral gap |λ₁/λ₂| ≥ 10, which is what §5 asserts. This is the check
 *      that catches a bad swap: pick an arithmetic group whose TBT gap is 3 and
 *      the pinned-seed story in the text stops being true.
 *
 * Plus housekeeping: unique ids, and the three-row structure the figure grid
 * assumes.
 */
import {
  FIGURES, ROW_TITLES, figureExample, figureAction, seedPaperFigure,
  PAPER_MIN_GAP, PAPER_SEED_NAME, type FigureRow,
} from '../../src/examples/hypergeometric/paperFigures.ts';
import { validateAllSymplectic } from '../../src/examples/hypergeometric/validate.ts';

let failures = 0;
const fail = (m: string) => { console.error(`  FAIL  ${m}`); failures++; };
const pass = (m: string) => console.log(`  ok    ${m}`);

// ─── Structure ──────────────────────────────────────────────────────────────

console.log('\nfigure list');
const ids = FIGURES.map((f) => f.id);
if (new Set(ids).size === ids.length) pass(`${ids.length} figures, ids unique`);
else fail(`duplicate figure id among ${ids.join(', ')}`);

const byRow = FIGURES.reduce<Record<string, number>>((m, f) => ((m[f.row] = (m[f.row] ?? 0) + 1), m), {});
for (const row of Object.keys(ROW_TITLES) as FigureRow[]) {
  const n = byRow[row] ?? 0;
  if (n === 3) pass(`row '${row}' (${ROW_TITLES[row]}): 3 panels`);
  else fail(`row '${row}' has ${n} panels, the 3×3 grid wants 3`);
}

// Rows 1 and 2 teach a signature, so their members must not share a parameter —
// otherwise a reader can attribute the shared look to the parameter, not the
// status. Warn (not fail): it is an editorial judgement, not a correctness bug.
for (const row of ['arithmetic', 'thin'] as const) {
  const members = FIGURES.filter((f) => f.row === row).map(figureExample);
  const alphas = new Set(members.map((e) => [...e.alpha].sort().join(',')));
  if (alphas.size === members.length) pass(`row '${row}': all ${members.length} α distinct`);
  else console.log(`  warn  row '${row}': only ${alphas.size} distinct α among ${members.length} panels — a reader could read the shared look off α rather than off the status`);
}

// ─── Structural validity ────────────────────────────────────────────────────

console.log('\nstructural');
const results = validateAllSymplectic(FIGURES.map(figureExample));
const bad = results.filter((r) => !r.passed);
if (bad.length === 0) pass(`all ${results.length} figures yield a valid symplectic companion pair`);
else for (const r of bad) fail(`${r.example.label}: ${r.errors.join('; ')}`);

// ─── The pinned seed, and the §5 spectral-gap claim ─────────────────────────

console.log(`\npinned seed γ = ${PAPER_SEED_NAME}, spectral gap (§5 claims ≥ ${PAPER_MIN_GAP})`);
let worst = { label: '', gap: Infinity };
for (const f of FIGURES) {
  const ex = figureExample(f);
  const s = seedPaperFigure(figureAction(f));
  const line = `${f.label} ${ex.label.padEnd(6)} |λ₁| = ${s.lambdaMax.toFixed(3).padStart(9)}  gap = ${s.gap.toFixed(3).padStart(8)}`;
  if (!Number.isFinite(s.lambdaMax) || s.lambdaMax <= 1) fail(`${line}  — TBT is not loxodromic here`);
  else if (!s.meetsGap) fail(`${line}  — below the ≥${PAPER_MIN_GAP} claimed in §5`);
  else console.log(`  ok    ${line}`);
  if (s.gap < worst.gap) worst = { label: `${f.label} ${ex.label}`, gap: s.gap };
}
console.log(`  info  tightest gap: ${worst.label} at ${worst.gap.toFixed(3)}`);

console.log(failures === 0 ? '\nPASS\n' : `\nFAIL — ${failures} problem(s)\n`);
process.exit(failures === 0 ? 0 : 1);
