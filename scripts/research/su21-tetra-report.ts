/**
 * Research report for an ideal tetrahedron configuration on ∂CH².
 *
 *   node scripts/research/su21-tetra-report.ts <A> <ζx> <ζy> <v> [--words L]
 *
 * Moduli: base face p₁p₂p₃ = idealTrianglePoints(A); p₄ = Heisenberg (ζ, v).
 * Prints the four face Cartan invariants against A* (the GP face filter),
 * the three opposite-edge pair classifications, the seed, and — with
 * --words L (default 4) — a scan of all cyclically-reduced words up to
 * length L with an ELLIPTIC alarm.
 *
 * Reading the alarm: an elliptic word means the group is NON-discrete unless
 * that element happens to have finite order (rational rotation angles). The
 * face filter (all four |A| ≤ A*) is necessary for the four GP face
 * subgroups; the word scan is the beginning of the rest of the story.
 */

import { formatWord } from '../../src/core/seed.ts';
import {
  classifyMirrorPair, cartanReport, scanEllipticWords,
} from '../../src/examples/complex-hyperbolic/diagnostics.ts';
import { GP_CRITICAL_A } from '../../src/examples/complex-hyperbolic/recipe.ts';
import {
  TETRA_EDGE_LABELS, tetrahedronMirrors, tetrahedronReflections,
  tetrahedronAction, seedTetrahedron, tetrahedronFromModuli,
} from '../../src/examples/complex-hyperbolic/tetrahedron.ts';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const flagVal = (n: string): string | null => {
  const i = process.argv.indexOf(n);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : null;
};
const [A, zx, zy, v] = [0, 1, 2, 3].map((i) => (args[i] !== undefined ? parseFloat(args[i]) : NaN));
if ([A, zx, zy, v].some(Number.isNaN)) {
  console.error('usage: node scripts/research/su21-tetra-report.ts <A> <ζx> <ζy> <v> [--words L]');
  process.exit(1);
}
const WORDS_LEN = flagVal('--words') ? parseInt(flagVal('--words')!, 10) : 4;

const pts = tetrahedronFromModuli(A, [zx, zy], v);
const mirrors = tetrahedronMirrors(pts);
const refl = tetrahedronReflections(pts);

console.log(`ideal tetrahedron:  A = ${A}   p₄ = Heisenberg(${zx} + ${zy}i, ${v})`);
console.log(`A* = ${GP_CRITICAL_A.toFixed(6)}\n`);

// ─── Face filter ────────────────────────────────────────────────────────────
const rep = cartanReport(pts);
console.log('faces (GP filter — each is a genuine subgroup):');
for (const t of rep.triples) {
  const name = `p${t.triple[0] + 1}p${t.triple[1] + 1}p${t.triple[2] + 1}`;
  const status = !t.withinGP ? '✗ FACE NON-DISCRETE'
    : t.ratioToCritical > 0.95 ? '⚠ near-critical' : '✓';
  console.log(`  ${name}  A = ${t.A.toFixed(6).padStart(10)}  |A|/A* = ${t.ratioToCritical.toFixed(4)}  ${status}`);
}
console.log(`  cocycle sum (must be ≈0): ${rep.cocycleSum!.toExponential(2)}\n`);

// ─── Opposite-edge pairs (invisible to the face filter) ─────────────────────
const OPP: readonly (readonly [number, number])[] = [[0, 5], [1, 4], [2, 3]];
console.log('opposite-edge mirror pairs:');
for (const [a, b] of OPP) {
  const c = classifyMirrorPair(mirrors[a], mirrors[b]);
  const extra = c.type === 'crossing' ? `angle = ${c.angle!.toFixed(4)}`
    : c.type === 'ultraparallel' ? `dist = ${c.distance!.toFixed(4)}` : '';
  console.log(`  ${TETRA_EDGE_LABELS[a]} vs ${TETRA_EDGE_LABELS[b]}:  ${c.type}  (η = ${c.eta.toFixed(4)})  ${extra}`);
}

// ─── Seed ───────────────────────────────────────────────────────────────────
const action = tetrahedronAction(pts);
const seed = seedTetrahedron(action);
console.log(`\nseed: γ = ${seed.name}, |λ_max| ≈ ${seed.lambdaMax.toFixed(3)}\n`);

// ─── Word scan (elliptic alarm) ─────────────────────────────────────────────
const scan = scanEllipticWords(refl, WORDS_LEN);
console.log(`word scan to length ${WORDS_LEN} (cyclic classes): ` +
  `${scan.loxodromic} loxodromic, ${scan.parabolic} parabolic, ${scan.elliptic.length} ELLIPTIC`);
for (const e of scan.elliptic.slice(0, 20)) {
  console.log(`  ⚠ elliptic: ${formatWord(e.word, TETRA_EDGE_LABELS)}  (f = ${e.f.toExponential(2)})`);
}
if (scan.elliptic.length > 20) console.log(`  … and ${scan.elliptic.length - 20} more`);
if (scan.elliptic.length === 0) console.log('  no elliptic words found at this length — candidate configuration ✓');
