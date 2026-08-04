# Note: the C-32 cone has 33 facets, not 77

While building the generic convex-hull machinery (`src/core/convex.ts`, validated
against C-32 as its first consumer) we found that the conical hull of the C-32
ping-pong domain's extremal rays has **33 facets**, whereas
`demos/c32/facets.ts` (`FACETS_H`) lists **77** covectors. This note records what
the 77 actually are and why 33 is the minimal facet count, with an exact proof.

Reproduce: `node scripts/tests/c32-cone-parity.ts`.

## The objects

- **Rays.** `demos/c32/background/c32_extremal_rays.json` — 254 integer extremal
  rays `rᵢ ∈ ℝ⁶` (u-basis), all with `y₀ > 0`, so `K = cone(r₁,…,r₂₅₄)` is a
  pointed, full-dimensional cone.
- **`FACETS_H`.** 77 integer covectors `h`, with `K ⊆ { y : h·y ≥ 0 }` for each.

## The finding

`facetsFromRays(rays)` returns **33** facet covectors — the complete minimal
facet description of `K`. All 33 are entries of `FACETS_H`, and each is tight on
≥ 5 rays (a genuine facet hyperplane in ℝ⁶ needs ≥ dim−1 = 5).

The other **44** covectors in `FACETS_H` are valid inequalities but **not facets**
of `K` — their hyperplanes barely touch the cone:

| rays the covector is tight on | count among the 44 non-facets |
|---:|:---|
| 0 rays | 33 |
| 1 ray  | 6  |
| ≥ 5 rays but not a facet\* | 5 |

\* these 5 have ≥5 tight rays that don't span a 5-dimensional facet hyperplane, so
they're still redundant.

**What the 44 are NOT — the dominance box.** It's tempting to attribute the extras
to the bounding box `{ y : |yᵢ| ≤ y₀ }` (`verify.md` check 1, `ℙ(K) ⊆ [−1,1]³`),
but that's wrong. The box has exactly 10 faces, `y₀ ± yᵢ ≥ 0`; **all 10 are in
`FACETS_H` and all 10 are genuine facets of K** (the cone touches every box wall),
so they're among the 33 — not among the 44. **Zero of the 44 non-facets are box
faces.**

**What the 44 are.** Other redundant valid inequalities, with large integer
coefficients unrelated to the box — e.g. `[187,676,1105,1045,556,127]` (tight on 1
ray), `[6,11,14,11,5,1]` (0 rays), `[259,−187,−808,−1501,−1573,−952]` (0 rays).
They come in structured sequences and negated pairs (suggesting group-orbit
images), and they originate in `c32_dual_cone_certificate_verifier.py` / paper
Appendix A. Their exact role belongs to the certificate side — likely candidate or
intermediate inequalities carried by the dual-cone certificate, not the minimal
facet description.

So: **`FACETS_H` (77) = the 33 facets of `K` ∪ 44 redundant non-facet
inequalities from the certificate.** It is an over-complete inequality system, not
the minimal facet set. (The 10 box faces are part of the 33, not the 44.)

## Why 33 is certainly correct (not an engine bug)

The computation is exact — the rays are integer, and `core/convex.ts` runs the
double-description method entirely in `BigInt`, so there is no floating-point
tolerance and no degeneracy guessing.

The decisive check is the duality `K** = K`. Let `F` be the 33 computed facets.
Then `cone(F)` is the dual cone `K*`, and its facets are the extreme rays of
`K** = K`:

```
facetsFromRays(rays) ............ 33 facets  F
facetsFromRays(F) ............... 254 rays   (missing 0, extra 0)  ← recovers K exactly
```

`facets(cone(F))` reproduces **all 254 original rays**, none missing and none
spurious. This round-trip closes if and only if `F` is the complete facet set —
an incomplete `F` would describe a strictly larger cone whose extreme rays would
not match the 254. (The engine also reproduces textbook cones: the positive
orthant → 3 facets, a square cone → 4 facets.)

## Consequences

- The **minimal** facet description of the C-32 cone is **33 covectors**; the
  generic machinery produces that.
- Nothing in the current demo is wrong. The 680-edge 1-skeleton is unchanged:
  `coneEdges` is incidence-based, and the 44 redundant covectors (tight on 0–1
  rays) contribute no incidence, so the edge count is identical whether computed
  from the 33 facets or from all 77.
- For the paper / certificate side: worth confirming whether the `FACETS_H` list
  is intentionally "facets + dominance box" (it looks deliberate). If a minimal
  H-description is ever wanted, it's the 33 facets tight on ≥5 rays.
