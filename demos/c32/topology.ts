/**
 * The combinatorial 1-skeleton of the polytope ℙ(K) — computed exactly from the
 * extremal rays + facets, independent of any projection (see implementation.md).
 *
 * The 254 rays are the vertices. Two vertices i, j are joined by an EDGE iff the
 * smallest face of K containing both is the 2-dimensional face they span — i.e.
 * exactly two rays are tight on every facet common to i and j:
 *
 *     A_i = { f : h_f · r_i = 0 }        (active/tight facets of ray i)
 *     i ~ j  ⟺  |{ k : A_k ⊇ A_i ∩ A_j }| = 2
 *
 * (Fukuda's combinatorial adjacency test.) Rays and facets are integer u-coords,
 * so the incidence test `h·r = 0` is exact; A_i is a 77-bit mask. For C-32 this
 * gives 680 edges (every vertex degree ≥ 5). Runs in ~20 ms.
 */

import { RAYS_U, NUM_RAYS } from './rays';
import { FACETS_H } from './facets';

/** Active-facet bitmask A_i for every ray (bit f set ⟺ h_f · r_i = 0). */
function incidenceMasks(): bigint[] {
  return RAYS_U.map((r) => {
    let mask = 0n;
    for (let f = 0; f < FACETS_H.length; f++) {
      const h = FACETS_H[f];
      let d = 0;
      for (let j = 0; j < 6; j++) d += h[j] * r[j];
      if (d === 0) mask |= 1n << BigInt(f);
    }
    return mask;
  });
}

/** Edges of ℙ(K) as ray-index pairs [i, j], i < j. */
export function coneEdges(): [number, number][] {
  const A = incidenceMasks();
  const edges: [number, number][] = [];
  for (let i = 0; i < NUM_RAYS; i++) {
    for (let j = i + 1; j < NUM_RAYS; j++) {
      const common = A[i] & A[j];
      if (common === 0n) continue;            // share no facet ⇒ not an edge
      let count = 0;
      for (let k = 0; k < NUM_RAYS; k++) {
        if ((A[k] & common) === common && ++count > 2) break;
      }
      if (count === 2) edges.push([i, j]);     // exactly i, j ⇒ an edge
    }
  }
  return edges;
}
