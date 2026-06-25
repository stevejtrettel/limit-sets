# Convex-domain machinery — plan

Dimension-agnostic machinery to take a convex body **given by its generators**
(extremal rays of a cone, or vertices of a polytope), compute its face structure
(facets, 1-skeleton), test membership, and visualize it through the **same**
ℝⁿ→ℝ³ `SceneEmbedding` + camera pipeline the limit sets already use. First
consumer + validation gate: the C-32 ping-pong cone ℙ(K) ⊂ ℝ⁶.

## Design (agreed)

Input is always the generators; we compute everything downstream:

```
generators V (extremal rays, given)
   │  ① V → H   double-description       ← the ONE real algorithm (exact, integer)
   ▼
facet normals F   (K = { x : f·x ≥ 0 })
   │  ② incidence (sign test)  +  ③ edges (Fukuda adjacency)   ← cheap, exact
   ▼
ConvexCone { rays, facets, edges }  →  project (SceneEmbedding) → draw
```

Only step ① is nontrivial; ②–③ are bitmask/linear-algebra and already exist in
`demos/c32/topology.ts` (lift + generalize into core). Inputs are integer, so the
whole core is **exact** (BigInt) — no ε, no degeneracy guessing.

### Layering

```
src/core/convex.ts          pure, dimension-agnostic, exact:
  ConvexCone value type
  facetsFromRays(rays) → facets         (double-description, dual form)
  coneEdges(rays, facets) → [i,j][]     (Fukuda combinatorial adjacency)
  contains(facets, x) → boolean
  transformCone(cone, M) → ConvexCone   (g·K copies)

src/app/convexMesh.ts       visualize a ConvexCone + SceneEmbedding → three.js:
  skeletonMesh  (project rays→points, edges→tubes — FAITHFUL, no hull)
  bodyMesh      (translucent silhouette = 3D hull of projected rays)
  membershipColors (recolor a limit set by inside/outside)

src/examples/hypergeometric/c32-cone.ts   DATA + bespoke math:
  the 254 rays; cone built via core; the exact dual-cone certificate verify()
```

## The algorithm (step ①, double-description, dual form)

Facets of `K = cone(R)` = extreme rays of the dual cone
`K* = { a : a·r ≥ 0 ∀ r ∈ R }`. Computing extreme rays of a cone given by
halfspaces (`a·r_i ≥ 0`, one per ray) is standard DDM:

1. **Init** from `d` linearly independent rays `B` (as halfspaces): the extreme
   rays of `{x : Bx ≥ 0}` are the columns of `adj(B)` (signed by `det B`); column
   `j` is tight on every `B`-halfspace except `j`. Exact integer cofactors.
2. **Incremental insert** each remaining halfspace `a`: partition current
   generators by `sign(a·g)` into `+ / 0 / −`; keep `+` and `0`; for each
   **adjacent** `(p⁺, n⁻)` add `(a·p)·n − (a·n)·p` (lies on `a=0`), gcd-reduced.
   Adjacency = Fukuda combinatorial test on active-halfspace bitmasks (no other
   generator's zero-set contains `Z(p) ∩ Z(n)`).
3. Output the resulting generators of `K*` = the facet normals of `K`.

All coordinates BigInt; gcd-reduce generators each step; active sets are BigInt
bitmasks.

## Stages

- **S1 ✅ DONE: `core/convex.ts` + validated against C-32.**
  `scripts/parity/c32-cone-parity.ts` (PASSED, exact, 0.4 s). Engine: exact BigInt
  double-description (`facetsFromRays`), Fukuda combinatorial edges (`coneEdges`),
  `contains`, `transformCone`, `coneFromRays`.

  **Finding — the cone has 33 facets, not 77** (see NOTE-c32-facet-count.md).
  `facetsFromRays(254 rays)` returns the **33** facets that are the COMPLETE
  minimal facet set of cone(rays). The certificate's 77 (`demos/c32/facets.ts`)
  is over-complete: the 33 real facets (which INCLUDE all 10 dominance-box faces
  `y₀±yᵢ≥0` — the cone touches every box wall) plus **44 redundant inequalities**
  — 34 are facets of the ping-pong copies `g·K` (group-orbit images of K's facets)
  and 10 are a parabolic certificate family. Validation is the self-certifying
  duality `K**=K`: `facets(cone(facets))` recovers all 254 rays (0 missing/extra),
  plus the 680-edge skeleton — both exact.
- **S2 ✅ DONE: `app/convexMesh.ts`** — generic, dimension-agnostic viz over a
  `SceneEmbedding`: `projectConeVertices`, `skeletonMesh` (faithful 1-skeleton),
  `coneSilhouette`+`bodyMesh` (translucent shadow), `coneDomainMesh` (both in one
  projection), `coneMembershipInstances` (projective membership coloring). Absorbs
  the generic guts of `hull.ts`/`wireframe.ts`/`membership.ts`. tsc clean.
- **S3 ✅ DONE: `examples/hypergeometric/c32-cone.ts`** — the 254 rays as data
  (inlined, node+vite portable); `c32Cone()` = `coneFromRays` (facets+edges via
  core, cached). Parity gate consumes it (PASSED: 33 facets, 680 edges, K**=K).
- **S4b ✅ DONE: rewired `demos/c32/main.ts`** onto core + app + example. Copies are
  `transformCone(c32Cone(), P·g)` (companion coords, carrying facets+edges); drawing
  is `coneDomainMesh`; membership coloring is `coneMembershipInstances`. Deleted
  `topology/hull/wireframe/membership/rays.ts`. Demo BUILDS; parity green;
  transformCone verified (copy S·K: 254 rays, 680 edges, every ray ∈ copy).
- **S4a (next): move the certificate to examples.** Per the user's decision, lift
  `group.ts`/`verify.ts`/`exactrank.ts` (+ the 77-row `FACETS_H`) into
  `examples/hypergeometric/c32-certificate/` as a kept, runnable exact verification
  (the GᵢK ⊆ K ping-pong/thinness proof — complementary to core's K**=K, not
  redundant). Wire its group construction to the example's α/β.
- **S4c (cleanup): mat6.** Still used by `coords.ts`/`copies.ts` (demo-local) + the
  certificate. Flatten onto `core/matrix` (or move with the certificate) — deferred,
  non-blocking. `demos/c32/facets.ts` stays until the certificate move absorbs it.

## Validation gate (exact)

- `c32Cone().facets` → **33** facets, each ⊆ the certificate's 77 and tight on
  ≥5 rays; `K**=K` round-trip `facetsFromRays(facets)` recovers all 254 rays.
- `c32Cone().edges` → **680** edges.
- Pure integer arithmetic ⇒ exact equality, no tolerance.
  (`node scripts/parity/c32-cone-parity.ts`)
