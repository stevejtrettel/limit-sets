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
  `scripts/tests/c32-cone-parity.ts` (PASSED, exact, 0.4 s). Engine: exact BigInt
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
- **S4a ✅ DONE: certificate → examples.** `group/verify/exactrank/facets/mat6` moved
  to `examples/hypergeometric/c32-certificate/`; `verify.ts` now sources its inputs
  from the catalog example (α/β → f,g via `cyclotomicProduct`) and the example cone
  (`C32_CONE_RAYS`). `npm run verify-c32` (repointed) → ALL CHECKS PASSED (dominance,
  GᵢK⊆K invariance, symplectic, Zariski density). The 77-row `FACETS_H` lives with
  the certificate; the parity gate's ⊆77 check imports it from there.
- **S4c ✅ DONE: mat6 gone from the demo.** `coords.ts`/`copies.ts` flattened onto
  `core/matrix` (`mat`/`matMul`/`matInverse`/`identity`); copies' `g` is now a flat
  `Mat`. `demos/c32/mat6.ts` deleted (a co-located copy remains certificate-local).

**INITIATIVE COMPLETE.** `demos/c32/` is thin wiring (`coords`/`copies`/`main`).
The convex machinery is core/convex (exact V→H + edges + membership + transform) →
app/convexMesh (project + draw) → examples (c32-cone data, c32-certificate proof),
all reusable + dimension-agnostic. Validated: c32 builds, parity green, certificate
passes, sibling demos build, tsc at the 3 pre-existing errors.

## Validation gate (exact)

- `c32Cone().facets` → **33** facets, each ⊆ the certificate's 77 and tight on
  ≥5 rays; `K**=K` round-trip `facetsFromRays(facets)` recovers all 254 rays.
- `c32Cone().edges` → **680** edges.
- Pure integer arithmetic ⇒ exact equality, no tolerance.
  (`node scripts/tests/c32-cone-parity.ts`)

---

## Follow-on: the offline FIGURE path (done)

The initiative above gave the live viewer its domain layer. Paper figures need
the same picture rendered offline, at figure depth and resolution. Added:

```
core/hull3.ts              3-D convex hull of a projected cloud — faces as merged
                           planar POLYGONS (not a triangle fan), edges with their
                           two incident faces, the surface-point set. Plus
                           hullViolation() as a self-check. This is the SHADOW
                           body: a chart of ℝ⁶ is a genuine projection, so what a
                           picture shows is the hull of the projected rays, and
                           core/convex (exact, in ℝⁿ) cannot supply it.
core/camera.ts             Camera.projectDepth — unclipped, carries view depth,
                           for drawing geometry rather than scattering points.
                           viewFrameAt — the camera's screen axes recovered as
                           scene directions by finite differences, so an overlay
                           can light itself relative to the view.
core/projector.ts          ProjectorOutput now returns {embedding, camera};
                           AutoProjectorOptions.extraFitPoints grows the autofit
                           rect around companion geometry (a percentile bbox
                           cannot absorb it as samples).
render/convexBody.ts       the figure: depth-buffer every face keeping the
                           NEAREST and FARTHEST hit, composite far layer then
                           near layer. Two crossings per ray through a convex
                           body ⇒ correct translucency AND no double-blended
                           seams. Then face edges (crisp/faint by depth test),
                           silhouette, vertex dots.
render/lineRaster.ts       drawThickLineAA / drawDiscAA — figure-weight strokes.
renderDriver.ts            RenderPlugin.overlay + autofitExtras hooks; the
                           overlay runs after the accumulator cache, so
                           restyling never re-runs the DFS.
examples/…/c32-domain.ts   the demo's coords.ts + copies.ts lifted into the
                           example (node cannot resolve the demos' `@/` alias, and
                           it was real math in a demo either way): P, the
                           coordinate systems, c32Chart, S/T⁻¹/E, the copy
                           presets, copyCone, coneBoundedInChart.
```

Validation (`node scripts/tests/c32-figure-gates.ts`): hull3 against known
answers (cube → 6 quads not 12 triangles, with coplanar + interior points added;
simplex; degenerate clouds; a random cloud vs a brute-force support function),
against the real ℙ(K) (zero residual, V − E + F = 2), the camera additions
(projectDepth agrees with project, orthonormal view frame, depth ordering), and
the overlay end to end (inks inside the body, not outside, in its own hue).

### The rosette chart (all six Sᵏ·K in one picture)

Drawing the rotation rosette needs an affine patch bounding all six copies at
once. No *coordinate* patch does (best: five of six, in the companion patches),
but the question is a linear feasibility problem, not a search over 12 options:
with εₖ the sign the denominator covector u takes on Sᵏ·K, we need
εₖ (u·Sᵏr) > 0 for every k and ray r, i.e. 0 ∉ conv{εₖ Sᵏ r}. Six of the 32 sign
patterns are feasible; the alternating one (the pattern S⁶ = −I forces) has the
widest margin, and its max-margin covector is that hull's min-norm point:

    ROSETTE_U = (5, 11, 14, 11, 5, 1)     normalized margin 0.01846 (opt 0.01865)

Added as a third entry in `COORD_SYSTEMS` (`rosette`, M = R·P⁻¹ with R an
orthonormal frame whose first row is u), so it reaches the demo's dropdown and
the renderer's `--coords` for free. One-signedness is asserted exactly (BigInt,
6 × 254 rays) in the figure gates, along with "no coordinate patch gets 6".

Known limit: the chart makes all six *visible*, but their shadows overlap heavily
— a 3-D projection of six 6-dimensional cones cannot separate them.

### Domains that run through infinity (done)

A copy whose cone straddles the chart's hyperplane at infinity used to be skipped
as "unbounded in this patch". Its affine picture is really TWO convex halves
racing off to opposite sides, and `core/convexChart.ts` now draws them.

Splitting the rays by the sign of the denominator d,

    half⁺ = conv{ π(rᵢ) : d·rᵢ > 0 } + cone{ π(rᵢ) − π(rⱼ) : d·rᵢ > 0 > d·rⱼ }
    half⁻ = conv{ π(rⱼ) : d·rⱼ < 0 } + cone{ the same directions, negated }

— a segment from rᵢ to rⱼ crosses d = 0 once and its image escapes along
π(rᵢ) − π(rⱼ), one way on each side. The implementation does NOT assemble that in
ℝ³: truncating to |π(x)_a| ≤ M is, where d·x > 0, the *linear* condition
M(d·x) ∓ R_a·x ≥ 0, so each half is the cone cut by 1 + 6 extra halfspaces and
its corners are the extreme rays of that — exact integer double description via
the new `raysFromHalfspaces` (the H→V reading of `facetsFromRays`).

Exactness needs integer facets, which `copyCone`'s float matrix inverse does not
give; so `copyChartPieces` cuts K itself (exact) with the chart pulled back
through G = P·g, then pushes the rays forward. Only the chart covectors are
rounded (1e-6 grid), and they only place the split plane and the truncation box.

Gate: bounded chart → one uncut piece; crossing chart → two truncated pieces, one
per side, all corners inside the box, and — the real check — every ray of the
original copy visible on a side lies inside the half that claims it.

**The cut is never drawn.** The truncation planes are π_a = ±M, axis-aligned in
chart space, so the lids they leave are exactly the hull faces with a coordinate
normal at offset M (`clipBoxFaces`). Body, rim edges and rim corners all go; the
long edges running out to the cut stay, so a half is OPEN at that end and reads
as continuing. An axis-aligned face that is genuinely the domain's (K has one, at
offset −1) is not mistaken for a lid — the gate checks both directions.

Both the offline renderer (`drawConvexBody({clipExtent})`) and the live viewer
(`coneDomainMesh({clipExtent})`) do this, so the viewer shows what the figure
will show. The viewer additionally reports `allLids` — when a half's shadow fills
the whole box, dropping the lids leaves nothing, and it says so instead of going
blank.

Known limit, same as the rosette's: two halves can have overlapping SHADOWS even
though they are disjoint in ℝ⁶, and a shadow can fill the frame entirely. Where
it does not (ℙ(K) in the u-basis z₂ patch, axes z₁z₃z₅) the two halves read
exactly as intended.

### Edge rendering: exact convex hidden-line (fix)  ← superseded

The first cut faded each edge by a per-pixel depth probe (`nearAt` sampling the
near-face depth buffer). That was flaky exactly where it mattered — creases and
grazing/edge-on faces near the silhouette — so up to ~40% of front edges were
drawn faint, and parts of the silhouette dropped to thin. For a CONVEX body the
depth buffer is unnecessary: an edge is VISIBLE (bold, full width) iff at least
one incident face points at the viewer, HIDDEN (faint, thin) iff both face away.
Per-face verdict ⇒ every edge of a face shares one weight: the whole silhouette
(each contour edge borders a front face) stays bold, and edges at a front vertex
are uniform. The occluding contour (front meets clearly-back, with an EPS band so
grazing faces don't misfire) is stroked thickest on top; vertex dots follow the
same rule. Style gained `hiddenEdgeWidth` (back edges thinner as well as fainter).
The old `strokeDepthFaded` probe survives ONLY for an explicit `edges` list (the
`--wire skeleton` 1-skeleton), which has no hull-face adjacency. `facing` is exact
for the orthographic auto view, finite-differenced (accurate) for perspective
presets.

Refinement: classifying by each face's own facing sign broke at a SHALLOW crease —
two nearly-parallel faces straddling facing=0 (one +ε, one −ε) drew the almost-flat
interior fold as a thick "silhouette" and mixed edge weights at its vertices. Fixed
by unioning near-coplanar adjacent faces (normals within ~2.5°) into REGIONS with a
single summed-facing sign; a crease lies inside a region and can't flip, only a
genuine dihedral between opposite-sign regions is a contour. Swept 130 views (all
copies × 10 angles): false-silhouette and interior-mixed-vertex counts both 0 (were
1–2 per view).

### Linework rederived: one quantity, glass depth  ← CURRENT

The two sections below are history. Both, and the bold/faint scheme before them,
started from the wrong question — "is this edge in front or behind?" — and then
patched the answer. The question that has an answer is: **how much body lies
between this point and the viewer?** For a convex solid that is a one-line ray
intersection, `glassDepth` in `render/convexBody.ts`:

    δ(p) = min over faces with n·v > 0 of (offset − n·p)/(n·v),  clamped at 0.

δ > 0 ⇒ hidden. It is a **yes/no** question and the drawing treats it that way:
two weights, no gradient. Hidden pieces draw at `backWidthScale`/
`backOpacityScale` and go under the translucent body so the glass dims them
again; everything else draws full, on top. Strokes are cut into ~8px pieces and
each piece asks for itself, so a chord that dives from the surface into the body
switches exactly where it goes behind.

Two calibration mistakes were made and fixed here, both worth not repeating:

- **A graded weight is wrong.** Scaling weight by the SIZE of δ seems natural
  ("how much glass am I looking through") but δ falls to zero at an occluded
  edge's own endpoints, so hidden edges faded in and out at both ends and stopped
  reading as being round the back. An edge that is hidden is hidden along its
  whole length.
- **Width and opacity do not contribute equally.** An anti-aliased stroke keeps a
  fully-inked core until it goes sub-pixel, so narrowing it barely changes what
  the eye reads; opacity has to carry the contrast. Measured on the figure path,
  splitting the reduction evenly (0.55 width, 0.6 opacity) left hidden linework at
  **0.71** of the visible ink — nearly invisible as a cue. (0.5, 0.35) lands at
  0.58, where it reads. `hull.scale` is a tolerance scale (max |coordinate|, a
  distance from the ORIGIN), so it may be used for an epsilon and never as a
  body size.

What this deletes: the front/back classification, the near-coplanar region union,
the `nearAt` depth-buffer probe, and the special case for an explicit edge list.
δ is a property of a POINT, so hull edges, interior 1-skeleton chords and vertex
dots all go through the same code, and strokes meeting at a corner agree there by
construction — the flat-vertex weight mixing cannot occur.

**Why the old scheme had to go, measured.** Against δ as an oracle, over 13 copies
× 200 view directions = 208,295 edge verdicts:

| rule | wrong | worst error |
|---|---|---|
| plain per-face (exact) | 2 | 6.4e-5 (rounding) |
| **region union (what shipped)** | **473** | **1.37 × the body's own size** |
| per-face + dead band 0.02 | 1876 | 2.54 |

The region union traded 471 extra misclassifications — including edges buried more
than a body-diameter deep, drawn as if on the near surface — for 38 fewer
flat-vertex weight mixes. That was invisible only because weight did not depend on
the verdict; it could never have been made to.

Gates (`scripts/tests/c32-figure-gates.ts` §3b): cube answers by hand (far corner
= 2√3 deep, 3 of 12 edges hidden); every copy × 60 directions against a BISECTION
on point-in-body membership, which shares no code with the formula — and held to
the bisection's own accuracy tol/(n·v), since the closed form is the accurate one;
the true Lipschitz bound 1/min(n·v) along a stroke (it is NOT 1 — a ray grazing
its exit face changes exit distance fast, measured 112.9 against a predicted 113);
and δ=0 recovering the classical rule at surface points.

### Offline edges rebuilt to match the live viewer  ← superseded

The bold/faint + thick-silhouette hidden-line styling read badly in PNGs. Replaced
with the three.js model: edges and vertex dots at ONE uniform weight, occlusion by
DRAW ORDER — back-of-body linework laid down first, the translucent body
composited over it (dimming it "through the glass"), front linework on top; a
wireframe-only render is uniform throughout. Region facing still decides which
side an edge is on, but now only sets draw order, never weight, so a near-
silhouette misjudgement is invisible. The separate thick outline pass and
`strokeDepthFaded` are gone. Vertex dots (both offline `convexBody` and live
`convexMesh`) now sit ONLY at true hull CORNERS (vertices in the face loops),
never at a ray that merely lands on a face's interior — fixes stray dots in the
viewer.
