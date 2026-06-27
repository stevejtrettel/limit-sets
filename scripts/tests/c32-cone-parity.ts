/**
 * C-32 cone parity gate — validates the generic core/convex V→H engine against
 * the C-32 ping-pong cone K = cone(254 extremal rays) ⊂ ℝ⁶.
 *
 * Ground truth (established here, exactly):
 *   • cone(rays) has 33 facets — the COMPLETE minimal facet set. (The 77 covectors
 *     in demos/c32/facets.ts are over-complete: the 33 real facets PLUS the
 *     dominance-box bounding inequalities y₀±yᵢ≥0, which clip but don't facet the
 *     cone — they're tight on 0–1 rays. The 33 are exactly the FACETS_H entries
 *     that touch ≥5 rays and span a facet hyperplane.)
 *   • The duality certificate K**=K: facets(cone(facets)) recovers all 254 rays.
 *   • The 1-skeleton has 680 edges.
 *
 * Integer input ⇒ everything exact, no tolerance.
 *
 *   node scripts/tests/c32-cone-parity.ts
 */

import { facetsFromRays } from '../../src/core/convex.ts';
import { c32Cone, C32_CONE_RAYS } from '../../src/examples/hypergeometric/c32-cone.ts';
import { FACETS_H } from '../../src/examples/hypergeometric/c32-certificate/facets.ts';

const RAYS = C32_CONE_RAYS as readonly (readonly number[])[];
const cone = c32Cone(); // the example module: rays + core-computed facets + edges

// canonical key: primitive integer covector, first nonzero entry positive
function key(v: readonly number[]): string {
  const g = v.reduce((acc, x) => {
    let a = Math.abs(acc), b = Math.abs(x);
    while (b) { [a, b] = [b, a % b]; }
    return a;
  }, 0);
  const p = g ? v.map((x) => x / g) : v.slice();
  const lead = p.find((x) => x !== 0) ?? 0;
  const s = lead < 0 ? p.map((x) => -x) : p;
  return s.join(',');
}

const t0 = process.hrtime.bigint();
const facets = cone.facets;                     // V → H (computed by the example via core)
const roundtrip = facetsFromRays(facets);       // H → V  (must recover the rays)
const t1 = process.hrtime.bigint();

// (1) the computed facets are all genuine entries of the certificate's list
const certified = new Set(FACETS_H.map(key));
const subsetOfCert = facets.every((f) => certified.has(key(f)));

// (2) every facet is tight on ≥5 rays (a real facet hyperplane)
const dot = (h: readonly number[], r: readonly number[]) => h.reduce((s, x, i) => s + x * r[i], 0);
const minTight = Math.min(...facets.map((f) => RAYS.filter((r) => dot(f, r) === 0).length));

// (3) K** = K : facets(cone(facets)) is exactly the 254 input rays
const raySet = new Set(RAYS.map(key)), rtSet = new Set(roundtrip.map(key));
const rtMissing = [...raySet].filter((k) => !rtSet.has(k)).length;
const rtExtra = [...rtSet].filter((k) => !raySet.has(k)).length;

// (4) the 1-skeleton (computed by the example via core)
const edges = cone.edges.length;

console.log(`rays:               ${RAYS.length}`);
console.log(`facets computed:    ${facets.length}   (complete facet set of cone(rays))`);
console.log(`  ⊆ certificate 77: ${subsetOfCert}    min rays-tight-per-facet: ${minTight} (≥5 ✓)`);
console.log(`round-trip K**=K:   ${roundtrip.length} rays   missing ${rtMissing}  extra ${rtExtra}`);
console.log(`edges (1-skeleton): ${edges}   (expect 680)`);
console.log(`time: ${(Number(t1 - t0) / 1e6).toFixed(0)} ms`);

const pass = RAYS.length === 254 && facets.length === 33 && subsetOfCert &&
  minTight >= 5 && roundtrip.length === 254 && rtMissing === 0 && rtExtra === 0 && edges === 680;
console.log(pass ? '\nC-32 cone parity PASSED (exact).' : '\nFAILED.');
process.exit(pass ? 0 : 1);
