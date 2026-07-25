# c32 — the C-32 limit set with its ping-pong domain ℙ(K)

An interactive viewer for the **C-32** hypergeometric group: its limit set Λ in
RP⁵, with the ping-pong convex domain **ℙ(K)** overlaid in the *same* ℝ³ chart and
camera. Two layers share one projection:

- **Λ** — instanced spheres (a proximal basepoint → BFS orbit);
- **ℙ(K)** — the cone's projected 1-skeleton (wireframe) and/or its translucent
  silhouette body, and its images under the group (the ping-pong "copies").

The demo is thin wiring (`main.ts`). The C-32-specific math — the coordinate
systems, the copy presets, the chart — is the `c32-domain` example, shared with
the offline figure renderer; everything else is generic machinery. This README
records that math.

For paper figures there is an offline path that draws the same picture as a
shaded convex solid: `node scripts/render/c32-render-limit-set.ts` (see
**Figures** at the end).

## The group and the limit set

C-32 is a degree-6 symplectic hypergeometric group. The `c32` catalog example
(`examples/hypergeometric/degree6-symplectic.ts`) carries the rotation tuples

```
α = (0,0,0,0,1/6,5/6)            f = cyclo(α) = x⁶ − 5x⁵ + 11x⁴ − 14x³ + 11x² − 5x + 1
β = (1/4,3/4,1/12,5/12,7/12,11/12)   g = cyclo(β) = x⁶ + 1
```

`symplecticAction(c32)` builds the monodromy as the companion matrices A₀, B₀ of
f, g acting on ℝ⁶ (the **companion basis**). The orbit is computed once there and
seeded automatically by `seedSymplectic` — the attracting fixed point of an
auto-found loxodromic word (here γ = BA, |λ_max| ≈ 9.9). No per-group constants:
the group, action, and seed all come from the shared hypergeometric recipe.

## The convex domain ℙ(K)

`K = cone(254 extremal rays) ⊂ ℝ⁶` is the C-32 ping-pong domain (u-basis, all
rays in {y₀ > 0}, so K is pointed and full-dimensional). The rays are the only
data: `examples/hypergeometric/c32-cone.ts` holds them, and `c32Cone()` computes
the rest **exactly** with `core/convex` (BigInt double description):

- **33 facets** — the complete minimal facet set (K = { y : f·y ≥ 0 ∀ facet f });
- **680 edges** — the 1-skeleton, projection-independent.

`ℙ(K)` is the projectivization. (On why the certificate's separate 77-row
inequality list is *over*-complete — 33 facets + 44 redundant inequalities — see
`NOTE-c32-facet-count.md`.)

## The coordinate pipeline

The orbit lives in ℝ⁶; we view it in a chosen coordinate system and affine patch.
Every point passes through one `ChartEmbedding` (ℝ⁶→ℝ³), built from selected rows
of a single matrix — **no PCA, explicit coordinate projections only**:

1. compute in the **companion basis** (the recipe's A₀, B₀);
2. transform to a coordinate system **z = M·x** — `companion` uses M = I, `u-basis`
   uses M = P⁻¹;
3. choose an affine patch — divide by coordinate `z_d` (the denominator row);
4. choose the ℝ⁶→ℝ³ map — a triple of view axes (z_a, z_b, z_c).

Because z_i = (row i of M)·x, stages 2–4 collapse: the chart's denominator and
numerator rows are just selected rows of M. One render path serves the orbit and
every domain copy. (`c32-domain.ts` builds M and assembles the embedding in
`c32Chart`.) The default view is the notebook's known-good framing: u-basis,
patch e₀, axes (2,4,5).

### P vs P⁻¹ (the change of basis)

P is defined by its **columns**: P = [v, −B₀v, B₀²v, −B₀³v, B₀⁴v, −B₀⁵v], so P's
columns are the u-basis vectors written in companion coordinates. Hence a point
satisfies x = P·y, i.e. **y = P⁻¹·x** — the transform on *coordinates* is the
inverse of the basis matrix, which is why the u-basis system uses M = P⁻¹.
Cross-check: P⁻¹B₀P = S, the signed shift. In the u-basis the normal form is
clean: B₀ → S (signed cyclic shift), T₀ → T (transvection), and the dominance
chamber Δ₀ = { |yᵢ| ≤ y₀ } projects to the cube [−1,1]³ in the e₀ chart, which
ℙ(K) sits inside.

## Copies of the cone

A "copy" is a u-basis element g; the copy is the cone g·K. `c32-domain.ts` provides
three presets (S = signed shift, T⁻¹ = inverse transvection, both u-basis):

| preset | elements | meaning |
|---|---|---|
| base | K | the domain itself |
| rotated | Sᵏ·K, k=0..5 | the six order-6 rotations (the rosette) |
| nested | T⁻¹Sᵏ·K, k=0..5 | the branch images, each ⊆ K |

A copy is drawn by transforming the base cone into companion coordinates,
`copyCone(g)` = `transformCone(c32Cone(), P·g)` — its rays become P·g·rᵢ
(projected by the same chart as Λ), while its facets and 680-edge skeleton carry
along unchanged (a linear iso preserves the face lattice). Whether a copy is
*drawable* is chart-dependent: a copy that crosses infinity in the current patch
is skipped (`coneBoundedInChart`).

Which patch shows what: in the **u-basis e₀** patch, K and all six nested images
are bounded but only S⁰·K of the rosette is; the companion patches get five of
the six rotations. No *coordinate* patch gets all six — but a general covector
does, and that is the third coordinate system:

### The rosette chart

A copy g·K is drawable in the patch {u·y = 1} exactly when u·y is one-signed and
nonzero over its rays. Asking for all six rotations at once is a linear
feasibility problem: with εₖ the sign u takes on Sᵏ·K, we need
εₖ (u · Sᵏ r) > 0 for every k and every ray r, i.e. 0 ∉ conv{εₖ Sᵏ r}. Six of the
32 sign patterns are feasible; the widest margin belongs to the alternating one
ε = (+,−,+,−,+,−) — the pattern S⁶ = −I asks for — and the max-margin covector is
that hull's min-norm point. Rounded to integers:

```
u = (5, 11, 14, 11, 5, 1)          normalized margin 0.01846 (optimum 0.01865)
```

`ROSETTE_U` in `c32-domain.ts`, with an orthonormal complement as the view rows
so the picture is isotropic rather than sheared. The gate verifies the
one-signedness exactly (BigInt) over all 6 × 254 rays. In this chart K, all six
Sᵏ·K, and all six nested images are simultaneously bounded:

```sh
node scripts/render/c32-render-limit-set.ts --copies rotated \
     --coords rosette --patch 1 --axes 2,3,6 --domain-opacity 0.45
```

### Domains that run through infinity

A copy whose cone straddles the chart's hyperplane at infinity is not
undrawable — its affine picture is **two convex halves racing off to opposite
sides**, with the gap between them the line at infinity. Splitting the rays by
the sign of the denominator d:

```
half⁺ = conv{ π(rᵢ) : d·rᵢ > 0 } + cone{ π(rᵢ) − π(rⱼ) : d·rᵢ > 0 > d·rⱼ }
half⁻ = conv{ π(rⱼ) : d·rⱼ < 0 } + cone{ the same directions, negated }
```

(a segment from rᵢ to rⱼ crosses d = 0 once, and its image escapes along
π(rᵢ) − π(rⱼ), one way on each side). Rather than assemble that in ℝ³,
`core/convexChart.ts` cuts it in ℝ⁶ where it stays exact: truncating to
|π(x)_a| ≤ M is, on the side where d·x > 0, the *linear* condition
M(d·x) ∓ R_a·x ≥ 0, so each half is K cut by seven extra halfspaces and its
corners are the extreme rays of that — exact integer double description. The cut
is made on K itself (facets exactly integer) with the chart pulled back through
G = P·g, then pushed forward; `--clip-extent` sets M relative to the visible
geometry, so the truncation lands off-frame.

```sh
# ℙ(K) itself splits in the u-basis z₂ patch — the clearest example
node scripts/render/c32-render-limit-set.ts --copies base \
     --coords u --patch 2 --axes 1,3,5 --clip-extent 8
```

The wireframe can draw two different edge sets, and the choice is shared between
the viewer ("wireframe edges") and the offline renderer (`--wire`), carried in the
saved preset so a framed view renders identically:

- **3-D hull boundary** (default) — edges of the projected shadow's own 3-D convex
  hull; the clean outline structure.
- **full 1-skeleton** — every edge of ℙ(K) in ℝ⁶ projected (all 680), including
  ones that land inside the silhouette; the mathematically faithful wireframe.

The **containing K** can be overlaid faint (light gray) behind the rotated/nested
images — viewer: "containing K"; offline: `--container`; also in the preset. It is
a no-op in `base` mode (K is already the domain) and is split into two halves at
infinity in charts where K is unbounded, like any copy.

The **viewer draws the same pieces** (Domains → "copies crossing infinity" →
*draw as two halves*, the default; *skip* restores the old behaviour). Two
controls come with it:

- **truncate halves at N×** — where the cut goes, as a multiple of the visible
  geometry. It only ever hides the far field, never changes the shape near Λ.
  Small live default (4×) because the viewer frames Λ, and a large value puts the
  camera *inside* the halves; the offline renderer wants it large (20×) so the
  cut lands off-picture.
- **frame the domain** — autofit on the domain's own points. Λ cannot find it for
  you: a few hundred domain corners never move a percentile taken over a million
  orbit points. Corners sitting on the cut are excluded from the fit — they are
  at a distance the slider chose, not one the geometry did, so framing on them
  would frame the truncation box instead of the domain.

**The cut itself is never drawn.** The truncation planes are π_a = ±M — axis
aligned in chart space — so the flat lids they leave are exactly the hull faces
with a coordinate normal at offset M (`clipBoxFaces`). Those are dropped: body,
rim edges, and rim corners. What is kept is the long edges running *out* to the
cut, so the half is open at that end and reads as continuing rather than ending
at a wall. A genuine face of the domain that happens to be axis-aligned (K has
one, at offset −1) is not mistaken for a lid.

The gate checks both halves: the cut loses nothing — every ray of the original
copy visible on a given side lies inside the half that claims it — and the lids
are identified exactly, none misread in either direction.

One consequence worth knowing: if a half's SHADOW fills the whole truncation box
(the projection collapses it completely), dropping the lids leaves nothing at
all. That is the honest answer, and the viewer says so rather than showing a
blank — "shadow fills the truncation box in this projection — try other view
axes". It is axis-dependent: in the u-basis z₂ patch the default axes (z₃,z₅,z₆)
collapse ℙ(K), while (z₁,z₃,z₅) show both halves properly.

Caveat worth knowing before making the figure: the six shadows **overlap heavily**
even though the cones themselves are disjoint in ℝ⁶ — a 3-D shadow of six
6-dimensional cones cannot keep them apart. The chart makes all six *visible*; it
does not make them read as a disjoint rosette. Lower `--domain-opacity`, or
`--domain wire` for outlines only, helps.

## Drawing and coloring

All visualization is generic `app/convexMesh.ts` over the active chart:

- **skeleton** — the faithful 1-skeleton: a sphere at each projected ray, a tube
  along each edge.
- **silhouette body** — the translucent 3-D convex hull of the *projected* rays.
  This is a shadow outline, **not** the projection of the cone's faces — distinct
  from the true skeleton; interior wireframe vertices are hidden against it unless
  "show interior" is on.
- **membership coloring** — instead of drawing hulls, tint each limit-set point by
  which copy g·K contains it. Containment is tested in ℝ⁶ against the copy's
  facets, so it is chart-independent and works even where a copy can't be drawn.

## Where the pieces live

```
demos/c32/main.ts          thin wiring: scene, HUD, "save view"

core/convex.ts             exact V→H (facets), 1-skeleton, membership, transformCone
core/hull3.ts              3-D hull of a projected cloud (the SHADOW body)
core/convexChart.ts        a cone's affine picture, split into halves at infinity
app/convexMesh.ts          live: cone + SceneEmbedding → skeleton/body/coloring
render/convexBody.ts       offline: cone + camera → shaded two-layer solid
examples/hypergeometric/
  c32-domain.ts            P, the coordinate systems, c32Chart, S/T⁻¹/E, the copies
  c32-cone.ts              the 254 rays (data) → c32Cone()
  c32-certificate/         the GᵢK ⊆ K ping-pong / thinness proof (npm run verify-c32)
scripts/render/c32-render-limit-set.ts    the offline figure renderer
scripts/tests/c32-figure-gates.ts         hull3 / camera / overlay gates
```

## Figures

`scripts/render/c32-render-limit-set.ts` renders Λ at figure depth and resolution
with the domain painted over it. The domain is drawn as a **two-layer translucent
solid**: every face is depth-buffered keeping the nearest and the farthest hit,
then the far layer and the near layer are composited once each. A convex body has
exactly two boundary crossings along any ray, so this is both correct
translucency and seam-free — no double-blended triangle edges.

The linework gets the hidden-line cue that makes the wireframe read as a solid,
from one yes/no question asked of each short piece of each stroke: **does the ray
from here to the camera pass through the body's interior?** For a convex solid
that is a single ray intersection (`glassDepth`). Hidden pieces are drawn thinner
and lighter *and* laid down under the translucent body, so the glass dims them
again; everything else draws at full weight on top. Two weights, no gradient — an
edge that is hidden is hidden along its whole length. Because the question is
asked of a point rather than of an edge, hull edges, the 1-skeleton's interior
chords and vertex dots are all handled the same way, and a chord that dives from
the surface into the body switches weight exactly where it goes behind.
`--back-edges 1` turns the cue off for the live viewer's uniform weight.
The key light is derived from the camera (`viewFrameAt`), so it falls from the
viewer's upper left in any framing.

Note the body is the cone's **shadow** — the 3-D hull of the projected rays
(`core/hull3`) — not the projection of its ℝ⁶ faces, since a chart of ℝ⁶ is a
genuine projection. Same object the live viewer's "silhouette body" draws.

Two ways to frame one:

```sh
# 1. interactively: frame it in the demo, press "save view", then render it
npm run dev c32                         # → outputs/presets/c32-view-preset.json
node scripts/render/c32-render-limit-set.ts --max-dim 4000

# 2. straight from the CLI (auto-fits Λ *and* the domain, so nothing is cropped)
node scripts/render/c32-render-limit-set.ts --copies base    --max-dim 4000
node scripts/render/c32-render-limit-set.ts --copies nested  --max-dim 4000
node scripts/render/c32-render-limit-set.ts --copies rotated --coords companion --patch 2
```

A saved preset carries the copies and the style as well as the camera, so a
figure is reproducible from it alone; flags override. `--domain full|body|wire|
none`, `--wire hull|skeleton|none`, `--vertices`, and `--domain-opacity F` tune
the look, and the accumulator cache means restyling the overlay does not re-run
the DFS.

The certificate is the companion mathematical artifact: an exact, integer proof
that the eleven branch maps contract K (dominance, invariance, symplecticity,
Zariski density). It is *complementary* to the cone's own correctness — `core`
certifies K**=K (the rays and facets are dual), the certificate certifies the
group's ping-pong dynamics.
