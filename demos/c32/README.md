# c32 — the C-32 limit set with its ping-pong domain ℙ(K)

An interactive viewer for the **C-32** hypergeometric group: its limit set Λ in
RP⁵, with the ping-pong convex domain **ℙ(K)** overlaid in the *same* ℝ³ chart and
camera. Two layers share one projection:

- **Λ** — instanced spheres (a proximal basepoint → BFS orbit);
- **ℙ(K)** — the cone's projected 1-skeleton (wireframe) and/or its translucent
  silhouette body, and its images under the group (the ping-pong "copies").

The demo is thin wiring (`coords.ts`, `copies.ts`, `main.ts`). All the real work
is generic machinery imported from elsewhere; this README records the C-32-specific
math the demo supplies.

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
every domain copy. (`coords.ts` builds M; `main.ts:coordChart` assembles the
embedding.) The default view is the notebook's known-good framing: u-basis, patch
e₀, axes (2,4,5).

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

A "copy" is a u-basis element g; the copy is the cone g·K. `copies.ts` provides
three presets (S = signed shift, T⁻¹ = inverse transvection, both u-basis):

| preset | elements | meaning |
|---|---|---|
| base | K | the domain itself |
| rotated | Sᵏ·K, k=0..5 | the six order-6 rotations (the rosette) |
| nested | T⁻¹Sᵏ·K, k=0..5 | the branch images, each ⊆ K |

A copy is drawn by transforming the base cone into companion coordinates,
`transformCone(c32Cone(), P·g)` — its rays become P·g·rᵢ (projected by the same
chart as Λ), while its facets and 680-edge skeleton carry along unchanged (a
linear iso preserves the face lattice). Whether a copy is *drawable* is
chart-dependent: a copy that crosses infinity in the current patch is skipped (the
boundedness gate in `main.ts`).

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
demos/c32/                 thin wiring (this demo)
  coords.ts                P, the u-basis change of basis; the coordinate systems
  copies.ts                S, T⁻¹, E (u-basis) + the base/rotated/nested presets
  main.ts                  scene, HUD, the render pipeline

core/convex.ts             exact V→H (facets), 1-skeleton, membership, transformCone
app/convexMesh.ts          project a cone through a SceneEmbedding → skeleton/body/coloring
examples/hypergeometric/
  c32-cone.ts              the 254 rays (data) → c32Cone()
  c32-certificate/         the GᵢK ⊆ K ping-pong / thinness proof (npm run verify-c32)
```

The certificate is the companion mathematical artifact: an exact, integer proof
that the eleven branch maps contract K (dominance, invariance, symplecticity,
Zariski density). It is *complementary* to the cone's own correctness — `core`
certifies K**=K (the rays and facets are dual), the certificate certifies the
group's ping-pong dynamics.
