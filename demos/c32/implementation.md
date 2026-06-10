# C-32 — limit set + ping-pong domains (implementation notes)

A living spec. We build this **incrementally**, confirming each slice before the
next, so it stays clean (no option-soup).

## Goal

Draw the C-32 hypergeometric limit set — the standard way we draw sp6 limit
sets — but with a **coordinate pipeline** that lets us view the *same* computed
orbit in several coordinate systems, and (later) overlay the convex ping-pong
domains from the "Thinness of C-32" note.

Source material (NOT the old `demos/sp6-c32/` demo, which we are abandoning):
- `demos/c32/background/c-32-5-30.pdf` — the paper.
- `demos/c32/background/c32_extremal_rays.json` — 254 extremal rays + 77 facets.
- `demos/c32/background/c32_dual_cone_certificate_verifier.py` — exact verifier.

## Non-goals / lessons

The previous attempt accreted ~9 coupled controls (basis × patch × axes × clip ×
color × domain-mode × …) and became unreadable. This time: a small, **staged**
pipeline with each stage independently selectable, and we add stages only once
the prior one is solid.

## The coordinate pipeline (4 stages)

The orbit is computed **once** in the companion basis (`makeSp6Action` = paper's
A₀, B₀). Everything after is per-view relabelling of those fixed points x ∈ ℝ⁶.

1. **Compute** — BFS orbit in companion coords → points `x`.
2. **Transform** — a projective map `M` (6×6): `z = M·x`. This is the
   "coordinate system" choice. Materialized once per selection over the whole
   orbit.
3. **Affine patch** — a denominator covector `d`: work where `d·z = 1`.
4. **Map to ℝ³** — 3 numerator rows `r₀,r₁,r₂`: `out_k = (r_k·z)/(d·z)`.

Stages 3–4 together are exactly the repo's `ChartEmbedding` (`denom` + 3 `rows`),
so once the orbit is transformed to `z`-space we reuse all existing machinery
(PCA-fit axes, explicit axis triples, percentile bbox, autofit camera, instanced
spheres). Stage 2 is the only new thing: "transform the orbit by M first."

## P vs P⁻¹ (the crucial change of basis)

The paper defines `P` **by its columns**: `P = [v, −B₀v, B₀²v, −B₀³v, B₀⁴v, −B₀⁵v]`,
with `v = (T₀−I)e₀`. Those columns are vectors written in the **companion**
basis, i.e. `P`'s columns ARE the u-basis vectors expressed in companion coords.

Therefore, for a physical point with companion-coords `x` and u-coords `y`:

    x = P·y      (since x = Σ yᵢ·uᵢ = P y)
    ⟹  y = P⁻¹·x

Cross-check (conjugation): B₀ on companion coords becomes `P⁻¹B₀P` on u-coords,
and the paper states `S = P⁻¹B₀P`. ✓

**Decision:** the u-basis view uses **M = P⁻¹** applied to each orbit point.
The matrix called "P" in the notes is the *basis* matrix; the transform on
*coordinates* is its inverse.

P (from the paper, integer, det P = −64):

    P =  0   5  11  14  11   5
         5   0  -5 -11 -14 -11
       -11  -5   0   5  11  14
        14  11   5   0  -5 -11
       -11 -14 -11  -5   0   5
         5  11  14  11   5   0

We store P as integers and compute P⁻¹ once numerically at load (projective, so
the −64 scale is irrelevant; we may unit-normalize z for numeric tidiness).

## The Mathematica notebook's recipe (the target picture)

`background/c32 in sp6r v4 dias ping pong.nb` already produces the picture we
want, via exactly this 4-stage pipeline. Decoded, its choices are:

- **basis (stage 2):** the **u-basis**. It orbits `gens = {S, T}` directly
  (`words13`, length-13 words → 8192 points) and the rays come from Dia already
  in the u-basis. We instead orbit the repo's companion generators and apply
  `M = P⁻¹` — same u-basis points, our standard machinery.
- **affine patch (stage 3):** `chart[vec_] := vec[[2;;6]]/vec[[1]]`, i.e.
  **denom = e₀** (the dominant coordinate y₀). Points with y₀ = 0 are dropped
  (`Select[Abs[#[[1]]] > 0 &]`).
- **map to ℝ³ (stage 4):** `proj[vec_] := vec[[{2,4,5}]]` applied to the chart
  5-vector → 0-indexed u-coords **(y₂, y₄, y₅)/y₀**. An explicit axis triple,
  NOT a PCA fit. → `denom = e₀`, `rows = e₂, e₄, e₅`.
- **overlay:** limit set + `ConvexHullRegion` of the projected 254 rays
  (`projectedvertices`) + the E-reflected hull (`EEprojectedvertices`) + the
  eleven Gᵢ branch-image hulls (`Gprojectedvertices`). (Step 4 territory.)

So our **default u-basis view** is: `M = P⁻¹`, patch `e₀`, axes `(2,4,5)`. PCA
remains available as an option, but `(2,4,5)/y₀` is the known-good framing to
match the notebook.

## Coordinate systems (initial set)

| name | M | notes |
|---|---|---|
| `companion` | I | the paper's A₀,B₀ basis; same as the sp6 limit-set demos |
| `u-basis (P)` | P⁻¹ | the normal-form basis where B₀→S (signed shift), T₀→T (transvection) |

More can be added later (e.g. an S-eigenplane "rosette" basis) without touching
stages 3–4.

## UI: the "Coordinates" folder

A single collapsible folder holding, top to bottom, the staged choices:
- **coordinate system** (stage 2): `companion` | `u-basis (P)`
- **affine patch** (stage 3): which `e_i` is the denominator (default e₀)
- **view axes** (stage 4): a single dropdown of the `C(5,3) = 10` triples of
  the non-denominator coordinates (the ℝ⁵→ℝ³ map; ascending → X,Y,Z). It
  regenerates when the patch changes. NO PCA. (Random projections may be added
  later as another stage-4 mode.)

A collapsible **View** folder holds the rendering controls (depth, ball radius,
fov). Color-by, reset, and screenshot stay top-level.

## Step 4a — drawing ℙ(K): conventions & algorithm

### Conventions (row/column, left/right) — get these right or the picture breaks

- **Points and extremal rays are COLUMN vectors; the group acts on the LEFT:**
  `x ↦ g·x` (matrix × column). This matches `makeSp6Action` (companion A₀,B₀).
- **The chart's `denom` and `rows` are ROW covectors**, acting on a column by
  dot product: `out_k = (row_k · z) / (denom · z)`.
- **Coordinate transform is left mult:** `z = M·x` (companion M=I, u-basis
  M=P⁻¹). The chart's denom/rows are the selected *rows of M*, since
  `z_i = (row i of M)·x`.
- **Facets `h` (rows of H) are ROW covectors:** `K = { y : h·y ≥ 0 ∀ h }`.
- **Duality (needed for transformed copies, Step 4b):** a LEFT action `g` on
  points is a RIGHT action `g⁻¹` on covectors. `g·K = { w : (h·g⁻¹)·w ≥ 0 }`.
  So copies use rays via **left** mult `g·rᵢ`; their facets would use **right**
  mult `h·g⁻¹`. Step 4a draws K itself, so no `g` yet — but we keep the rays as
  columns and any future map as a left mult on them.

### Rays → render coordinates

The 254 extremal rays in `background/c32_extremal_rays.json` are **u-coordinate
column vectors** rᵢ (all have y₀ > 0: the cone sits in {y₀>0}). Convert each once
to a **companion column vector** `rᵢᶜ = P·rᵢ` (P left-multiplies). Then rᵢᶜ flows
through the exact same `proj` chart as the orbit — in the u-basis the chart
undoes it (`z = P⁻¹·P·rᵢ = rᵢ`), in companion it reads `P·rᵢ`. One code path.

### Does the patch contain the whole cone?

ℙ(K) is a bounded blob in the current chart **iff the denominator covector is
one-signed over every ray**:

    dᵢ = denom · rᵢᶜ   (denom = active chart's row, = row `denomIdx` of M)
    bounded ⟺ min dᵢ and max dᵢ share a strict sign (all > +ε, or all < −ε).

If they straddle 0 the affine hyperplane {denom·z = 0} (the chart's "infinity")
cuts through the cone's interior — the hull would wrap through infinity, so we
**do not draw** and show a note. (The rare exact `dᵢ ≈ 0` — a ray exactly at
infinity — also fails the strict test.) In the u-basis with patch e₀, dᵢ = y₀ > 0
for all rays ⟹ always bounded; in other patches/bases it may not be.

### Shadow hull vs. true 1-skeleton (the important distinction)

There are two different objects:

- **Shadow / silhouette** = `ConvexHull(projected rays)`: project rays to ℝ³
  *first*, then hull. Its boundary is NOT the projected polytope boundary — true
  vertices that land inside the silhouette vanish, interior edges are lost. This
  is what the first 4a draft drew; it only shows the outline.
- **True 1-skeleton** = compute the 5-polytope's combinatorics FIRST (vertices +
  which pairs are edges), THEN project. Shows every vertex and edge, including
  the ones hidden in the shadow. **This is what we want.**

**Interior vertices are correct, not a bug.** Projecting a polytope sends many
vertices INTO the interior of the silhouette — exactly like a cube's shadow is a
hexagon with 2 of its 8 corners projecting inside. Collapsing the 5-polytope to
3-D, most corners end up interior: in the default u-basis (2,4,5) view, only 46
of the 254 vertices are on the silhouette boundary; the other 208 are interior.
The image-as-a-set is convex; its vertices need not all lie on the boundary.

### Computing the 1-skeleton (exact, integer, projection-independent)

Needs the 77 facets H (u-coords row covectors; in the background verifier
`c32_dual_cone_certificate_verifier.py`). For each ray rᵢ:

    A_i = { f : h_f · r_i = 0 }     (active/tight facets — exact integer test)

- Each rᵢ is a genuine vertex ⟺ rank{h_f : f∈A_i} = d−1 = 5. (Verified: all 254.)
- Vertices i, j are joined by an **edge** ⟺ the smallest face containing both is
  the segment ⟺ **exactly two** rays are active on all of A_i ∩ A_j:
  `|{ k : A_k ⊇ A_i∩A_j }| = 2`. (Fukuda's combinatorial adjacency test.)

Computed once at load with 77-bit incidence masks. Result for C-32: **254
vertices, 680 edges, every vertex degree ≥ 5, no isolated vertices.**

### Render

1. Project all 254 vertices rᵢᶜ via `proj.embed` → ℝ³ (same chart/camera as Λ).
2. **edges:** the 680 true edges as `TubeGeometry` between projected vertices.
3. **vertices:** a small sphere at each projected vertex.
4. **faces (optional):** the true 2-faces project to overlapping polygons (mush),
   so a "body" is best conveyed by the translucent *silhouette* (the shadow hull)
   if wanted at all — kept as a separate optional layer, TBD with user.

### On coordinate change

Re-run the boundedness test; if bounded, re-project + rebuild the hull; else
hide it and show the note. (Rays are fixed, so depth/color-by changes don't
touch the hull.)

## Step 4b — copies of the cone (S and T⁻¹)

A **copy** is a u-basis matrix g; the copy is the polytope g·K. Three facts keep
this clean:

1. **Same topology.** g is a linear iso ⇒ g·K has the SAME 1-skeleton as K
   (same index-pair `EDGES`); only vertex positions change (g·rᵢ). One
   `coneEdges()` serves every copy.
2. **Same render path.** A copy's companion rays are `P·g·rᵢ` (`transformedRays(g)`);
   they flow through the existing `proj` → boundedness gate → wireframe/hull
   unchanged. N copies = the single-copy path looped N times.
3. **Presets are matrix lists.** rotated = [Sᵏ], nested = [T⁻¹Sᵏ], k=0..5.

Conventions (consistent with 4a): rays are u-coord COLUMN vectors, g acts on the
LEFT (g·rᵢ). Verified: `P·S = B₀·P` (applying S in u ⟺ B₀ in companion),
`S⁶ = −I`.

**Boundedness (verified, u-basis e₀ chart):**
- rotated Sᵏ·K: only k=0 bounded; k=1..5 have (Sᵏr)₀ straddling 0 (unbounded) —
  need the symmetric "rosette" chart (4c) to see all six.
- nested T⁻¹Sᵏ·K: all six bounded and ⊆ K (k=2,4 come out sign-flipped, which the
  one-signed gate handles) — all six draw in the current view.

Modules: `copies.ts` (S_U, T_INV_U + `baseCopies/rotatedCopies/nestedCopies` →
`{label, g, edge/vertex/body colors}[]`); `rays.ts` gains `transformedRays(g)`;
`main.ts` keeps an `activeCopies` list (rebuilt only when the copy-mode changes),
and `rebuildDomains` loops over it with a per-copy boundedness gate. One new
"copies" dropdown in the Domains folder.

## Step 4e — cone-membership coloring (an alternative to drawing hulls)

Projections of a 5-polytope are hard to read. A second way to show the copies:
instead of drawing g·K, **color each limit-set point by which copy contains it**
(default **black**). This replaces the old word-structure "color by" control
(removed from the UI).

**Why it sidesteps boundedness.** Containment is tested in ℝ⁶, not in the chart,
so it is chart-independent and unaffected by the patch. The six rotated cones
color points correctly in *any* view — including the u-basis e₀ chart where five
of their hulls cannot be drawn. This is the main payoff.

**The test (left/right duality again).** A point lies in g·K (K = {y : Hy ≥ 0},
u-coords) iff g⁻¹y ∈ K. From companion coords x (y = P⁻¹x): w = g⁻¹P⁻¹x, orient
by sign(w₀) (K ⊂ {w₀>0}), require H·w ≥ 0. Per copy precompute
`A = g⁻¹P⁻¹`, `row0 = A₀`, `HA = H·A` (facets right-acting on x: H ↦ H·g⁻¹). Then
the test is dot products on the companion vector — exact-ish, scale-invariant in
sign, fast with per-facet early-exit. A point is colored by the first containing
copy (rotated copies are chamber-disjoint, so at most one).

**Modules.**
- `mat6.ts` (new): consolidated 6×6 helpers (`matmul6`, `matvec6`, `invert6`,
  `I6`) — coords/copies/rays/membership all use it (was duplicated 3–4×).
- `membership.ts` (new): `makeConeTest(g)` → `ConeTest`; `inCone`; `colorAt`
  (first containing copy, else black); `hexToRgb`; `buildMembershipInstances`
  (the colored `{aPos,aColor,kept}`; one embed pass, companion vecs drive color).

**UI.** The Domains "convex domain" control gains a `coloring` mode; in that mode
no hulls are drawn and Λ is recolored by membership over the active copies. The
"color by" (word-structure) dropdown and its `colorDepth` state are removed.

Use: copies = `rotated S·K` + `coloring` ⇒ Λ colored by which of the six SᵏK each
point lies in, in any chart. Later: draw the base K and color the points inside
it by which branch copy (nested T⁻¹SᵏK) they fall in.

## Build plan (incremental)

- [x] **Step 1** — bare C-32 limit set in the companion basis. New
      `demos/c32/main.ts`, locked to example `c32`, a fixed coordinate
      projection (denom e₀, axes (3,4,5), provisional; framing nailed in Step 2
      via the u-basis), autofit camera. Confirms the orbit/render path works for
      C-32. Run: `npm run dev c32`. Typechecks clean.
- [x] **Step 2+3** — the full "Coordinates" folder (`demos/c32/coords.ts` +
      panel folder): coordinate-system selector (companion `M=I` ↔ u-basis
      `M=P⁻¹`), affine-patch selector (which `z_i` is the denominator), and
      three view-axis selectors (X/Y/Z ← any `z_i`). The chart reads selected
      *rows of M* — one render path, no orbit copy. Defaults to the notebook
      view (u-basis, patch z₁=e₀, axes (2,4,5)). Verified numerically:
      `P⁻¹B₀P = S`, `P⁻¹T₀P = T`. Typechecks clean.
- [x] **Step 4a** — draw ℙ(K) over Λ as the **true 1-skeleton** + an optional
      silhouette body. Modules:
      - `rays.ts` — 254 rays → companion columns rᵢᶜ = P·rᵢ.
      - `facets.ts` — the 77 facets H (generated from the background verifier).
      - `topology.ts` — `coneEdges()`: exact 1-skeleton from incidence (254
        vertices, 680 edges; ~20 ms, computed once at load).
      - `wireframe.ts` — instanced spheres (vertices) + instanced cylinders
        (edge tubes); two draw calls.
      - `hull.ts` — `buildHullBody()`: three ConvexHull, **faces only** (the
        silhouette/shadow; the wireframe owns vertices+edges).
      - `main.ts` "Domains" folder: none / wireframe / wireframe+body / body,
        an **interior-vertices show/hide** toggle (**defaults to hide** ⇒ only
        silhouette-boundary vertices + edges between them), + a size slider;
        boundedness gate (`denom·rᵢᶜ` one-signed) re-checked on every change.
      - Boundary classification (`computeShadow`): a vertex is "boundary" iff it
        lies ON the silhouette surface — `max_f distanceToPoint(p) > −ε` over the
        hull faces — NOT merely if it is a hull corner. The cone is flat in
        places, so many rays land on the interior of a face/edge (still on the
        boundary); the corner-only test wrongly hid them and their edges. In the
        default view: 193 boundary vs 61 interior (corner-only gave just 46).
- [x] **Step 4b** — copies engine. `copies.ts` (S_U, T_INV_U + base/rotated/
      nested copy lists with colors); `rays.transformedRays(g)` = P·g·rᵢ;
      `main.ts` keeps `activeCopies` (rebuilt on copy-mode change) and loops
      `rebuildDomains` over them with a per-copy boundedness gate. New "copies"
      dropdown: K / rotated S·K (×6) / nested T⁻¹S·K (×6). Shared `EDGES`
      (copies are linear isos). Nested: all six draw; rotated: only the bounded
      ones until 4c.
- [x] **Step 4e** — cone-membership coloring. `mat6.ts` (consolidated 6×6
      helpers) + `membership.ts` (`makeConeTest`/`inCone`/`colorAt`/
      `buildMembershipInstances`). New `coloring` representation mode; word-
      structure "color by" dropdown removed. Chart-independent (tests in ℝ⁶), so
      the six rotated cones color Λ in any view. Verified: each chamber's
      witness lands in exactly its own cone (clean 6-way partition).
- [ ] **Step 4c** — (next) the S-symmetric "rosette" coordinate system so all
      six rotated copies show at once. Just a new entry in `COORD_SYSTEMS`
      feeding the same engine.
- [ ] **Step 4d** — (optional) the E-reflected branch variants (the full 11
      paper maps); another copy-list preset.

## Status

Steps 1–3 done. `demos/c32/main.ts` draws the C-32 limit set with a full
"Coordinates" folder: coordinate system (companion ↔ u-basis = P⁻¹), affine
patch (denominator), and X/Y/Z view-axis pickers. Opens on the notebook's
known-good view (u-basis, patch e₀, axes (2,4,5)). `demos/c32/coords.ts` holds
P, P⁻¹, and the coordinate systems. Typechecks clean; conjugation verified
(`P⁻¹B₀P=S`, `P⁻¹T₀P=T`).

Step 4a done: ℙ(K) drawn as the true 1-skeleton (254 vertices + 680 edges, from
`topology.ts`) via `wireframe.ts`, plus an optional silhouette body
(`hull.ts`, faces only). Modules: rays/facets/topology/wireframe/hull + a
"Domains" folder (none / wireframe / wireframe+body / body) with the
boundedness gate. Opens on the **silhouette shell** (interior vertices hidden by
default). `main.ts` cleaned up: honest header, unified single initial build,
domain colors/defaults as named constants.

Step 4b done: copies engine (`copies.ts` + `transformedRays`), "copies" dropdown
(base K / rotated S·K ×6 / nested T⁻¹S·K ×6), per-copy boundedness gate + color,
shared `EDGES`. Nested shows all six (inside K); rotated shows the bounded copy
until the rosette chart.

Step 4e done: cone-membership coloring (`mat6.ts` consolidation + `membership.ts`).
New "show ℙ(K) as → coloring" mode colors Λ by which copy each point lies in
(black if none), tested in ℝ⁶ so it works in any chart; the word-structure
"color by" dropdown is removed. Verified clean 6-way chamber partition. Run:
`npm run dev c32` (copies = rotated S·K, show as = coloring). Next: Step 4c
(rosette coordinate system).
