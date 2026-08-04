# limit-sets

Interactive browser viewers and offline high-resolution renderers for the
**limit sets** of finitely-generated matrix groups acting on projective space —
hypergeometric monodromy groups (the full degree ≤ 7 classification, orthogonal
and symplectic), convex projective and Anosov representations on RP², Kleinian
groups on CP¹, SL(4,ℝ) Hitchin reps on RP³, SL(7,ℝ) Goldman–Parker triples on
RP⁶, SU(2,1) complex hyperbolic groups on ∂CH² = S³, SL(3,ℤ[√d]) drawn through
its Galois embedding, and the Schwartz–Pappus modular-group construction.

The code is written to read as close to the underlying mathematics as possible:
one generic engine draws every family, and each family contributes only its data
plus the small recipe that turns that data into a group action.

---

## Quick start

Requires **Node ≥ 23.6**, where TypeScript type-stripping is on by default — the
scripts under `scripts/` are run as `.ts` directly, with no build step.
(Developed on Node 25.)

```sh
npm install
npm run dev hypergeometric-atlas      # → http://localhost:5173
```

That opens the **hypergeometric atlas**, the best first stop: every hypergeometric
monodromy group of degree ≤ 6 — 789 of them, from O(1) up to Sp(6,ℝ). The control
panel on the left picks a table (one per degree + invariant-form type, opening on
O(3,2)) and then a group within it; its limit set is drawn live.

One demo is served at a time. `npm run dev <name>` rewrites the `<script>` tag in
`index.html` to `demos/<name>/main.ts` and starts Vite; `npm run build <name>`
bundles that demo into `dist/<name>/`, and `npm run preview <name>` serves the
bundle. `<name>` is any directory under [`demos/`](demos/) — see the
[demo list](#demos) below.

```sh
npm run dev hypergeometric-atlas   # 789 groups, degree ≤ 6      (start here)
npm run dev su21                   # Goldman–Parker on ∂CH² = S³
npm run dev c32                    # C-32 + its ping-pong cone
npm run build hypergeometric-atlas # production bundle → dist/
```

To take a picture at higher depth and resolution than the browser can manage,
frame it in the viewer and hand the view off to a render script — see
[Offline render](#offline-render).

---

## Architecture at a glance

Everything is one pipeline. A finitely-generated group acting linearly on ℝⁿ
gives an orbit; the orbit projects to ℝ³ and then to pixels:

```
  GroupAction (apply g·v in ℝⁿ)
        │   orbit walker (non-backtracking word tree: BFS, or streaming DFS)
        ▼
  Orbit  (points on Sⁿ⁻¹, a cover of RPⁿ⁻¹)
        │   SceneEmbedding  (ℝⁿ → ℝ³ — a projective chart, sphere map, …)
        ▼
  ℝ³ scene points
        │   Camera  (ℝ³ → pixel: perspective or orthographic)
        ▼
  pixels  →  live three.js mesh   OR   offline accumulator → tone-map → PNG
```

The code is layered by **how reusable each piece is**:

| layer | what it is | rule |
|---|---|---|
| **`src/core/`** | generic mathematical abilities | **no example data, ever** |
| **`src/examples/`** | catalogs (data) + recipes (data → action) | named by the math |
| **`src/render/`, `src/app/`** | visualization (offline raster / live three.js) | depend only on core interfaces |
| **`demos/`, `scripts/`** | concrete instances — wiring + UI | pick an example, render it |

### `src/core/` — the engine (no data)

- **`group.ts`** — `GroupAction`, the one abstraction the whole engine is built
  on. `apply(g, src → dst)` writes `dst = g · src` (left action); `inverse[g]` is
  the code of `g⁻¹`; optional `normalize` keeps states on the unit sphere.
- **`matrix.ts`** — flat row-major matrices (`Mat = Float64Array`, dimension
  inferred from length). `mat([[…]])`, `matMul`, `matInverse`, `matDet`,
  `matTrace`, `matScale`, `matSub`, `companion`. One representation, dimension-
  generic; the same layout as the orbit state vectors.
- **`matrixAction.ts`** — `makeMatrixAction(alphabet)` turns a list of generator
  matrices into a `GroupAction` (dimension inferred). The **alphabet** is the one
  group-theoretic choice: `asInvolutions` (Coxeter), `pairWithInverses` (free
  group), or `generatingSet` (mixed, e.g. a free product). Plus `normalizeSphere`.
- **`complexMatrix.ts`, `complexMatrixAction.ts`** — the complex mirror of the
  two files above: flat interleaved complex matrices and
  `makeComplexMatrixAction` (same three alphabet builders) for subgroups of
  GL(n,C) acting on CP^{n-1}; the state is the realified vector in R^{2n}.
  Pinned against the bespoke Kleinian apply by `scripts/tests/su21-gates.ts`.
- **`polynomial.ts`** — `cyclotomicProduct`: rotation tuples → integer polynomial
  (the hypergeometric construction).
- **`seed.ts`** — find a basepoint *on* the limit set. `seedFromLoxodromic`
  (auto-search the word tree, certified by the spectrum), `seedFromWord` (explicit
  override word), `findLoxodromicWord`, the real/complex dominance criteria.
- **`orbit.ts`** — the hot loop: `generateOrbit` (BFS, stored), `streamOrbit`
  (DFS, O(depth) memory), `computeProximalBasepoint` (power iteration).
- **`chart.ts`** — projective chart embeddings π(v) = (R·v)/(d·v): axis, PCA, and
  auto-chart (projective PCA). **`scene.ts`** — `SceneEmbedding` (ℝⁿ→ℝ³, the
  math-meets-picture seam) + `composeProjector`. **`camera.ts`**,
  **`projector.ts`** — ℝ³→pixel + autofit.
- **`subdivision.ts`** — an n-ary subdivision-tree walker (for constructions that
  aren't matrix groups, e.g. Pappus marked boxes).
- **`viewPreset.ts`**, **`validation.ts`** — the shared on-disk view-preset
  contract and the startup-validation harness.

### `src/examples/` — catalogs + recipes (the families)

Each family is **data + a thin recipe**. None of this lives in core, because it
names specific groups.

- **`hypergeometric/`** — the unified O(5)+Sp(6) family. `recipe.ts`'s
  `hypergeometricAction(α, β, walk)` builds the companion matrices of the
  cyclotomic products of α, β and walks them (`free` or `free-product`). Catalogs:
  `degree5-orthogonal.ts` (77 Bajpai–Singh groups, generated from CSV),
  `degree6-symplectic.ts` (88 Bajpai–Doña–Nitsche groups + a `FEATURED`
  shortlist), and the full classification atlases `degree-le6.ts` (789 groups)
  and `degree7.ts` (509 groups) — both generated by
  `scripts/catalog/gen-hypergeometric-catalog.ts`, sharing the types and the
  row → example derivation in `atlasCatalog.ts`. One recipe, several data files;
  "O(5) vs Sp(6)" is emergent from the tuples. Alongside the transcribed tables,
  `all-half-{even,odd}.ts` are the *generated* all-half towers Γ_d =
  ⟨Comp((x−1)^d), Comp((x+1)^d)⟩ — one construction at every degree, where the
  parity of d flips T = G·F⁻¹ between a reflection (free product) and a
  symplectic transvection (free group). `c32-cone.ts` / `c32-certificate/` carry
  the C-32 ping-pong cone K: its 254 extremal rays and the exact ℚ verification
  that every branch map satisfies GᵢK ⊆ K.
- **`projective/`** — matrix groups on RP² / RP³. `rp2.ts` (shared sphere +
  affine-plane embeddings), `triangle-groups/` (Coxeter + 4-reflection reps),
  `rp3-pairs/` (GL(4,ℝ) pairs), `rp6-triples/` (SL(7,ℝ) Goldman–Parker
  three-involution groups — reducible, so the limit set really lives on an
  invariant RP², a reduction the code performs rather than hard-codes),
  `schwartz-pappus/` (the modular-group Pappus construction — both the `box.ts`
  subdivision presentation **and** the `matrices.ts`/`duality.ts`/`recipe.ts`
  Anosov-matrix presentation).
- **`kleinian/`** — Möbius groups on CP¹. Keeps a bespoke complex 2×2 `apply` (the
  complex matvec reads closer to the math than a realified 4×4); seeds with the
  complex dominance criterion.
- **`complex-hyperbolic/`** — SU(2,1) acting on ∂CH² = S³ ⊂ C² (ball model,
  form diag(1,1,−1)). `hermitian.ts` carries the form vocabulary (Hermitian
  product, polar vectors, the Cartan angular invariant, the Cayley map to the
  Siegel form); `recipe.ts` builds complex reflections R_ζ (any order) and the
  **Goldman–Parker ideal triangle groups** from three boundary points — or just
  the Cartan invariant A, a complete parameter (`idealTrianglePoints(A)`, with
  the derivation in its doc comment). The discreteness dial is Goldman's trace
  discriminant on ι₁ι₂ι₃, critical at A* = arctan√(125/3) (= Goldman–Parker's
  s̄² = 125/3 under s = tan A; pinned by gates). `triangleGroup.ts` is the
  finite-vertex sibling — (p,q,r) groups whose mirrors meet inside CH², swept by
  the phase φ with the R-Fuchsian group at φ = π; `tetrahedron.ts` is the
  four-ideal-point research instrument. Two fixed embeddings: stereographic
  S³ → R³ and Heisenberg (ζ, v).
- **`galois-sl3/`** — a one-parameter pair ⟨A(t), B(t)⟩ ⊂ SL(3, ℤ[t,1/t]) specialized
  at real quadratic UNITS t (`quadratic.ts` rejects non-units, where 1/t would
  leave 𝒪_K), then pushed into SL(3,ℝ)×SL(3,ℝ) ⊂ SL(6,ℝ) by the two real places,
  γ ↦ diag(γ, γ^σ). Since the family is ℤ[t,1/t]-rational the Galois conjugate is
  just t ↦ t^σ. The block sum preserves each factor's 3-plane, so the seed is the
  JOIN of the two factors' attracting fixed points (`seedFromBlockLoxodromic`) —
  the demo's `seed` dropdown also shows the degenerate single-factor basepoints,
  whose orbits stay trapped in a plane.
- **`james-marit/`** — an SL(4,ℝ) Hitchin/Anosov rep of the once-punctured torus
  group, built as an affine cohomological deformation of a fixed SO(2,1) base rep:
  `so21Rep` (base) + `cohomology` (φ-twist) + `cocycle` (solve `v_{[a,b]}=0`) +
  `recipe` (assemble the 4×4) + `fabiChart` (RP³→ℝ³).

### Seeding — how a basepoint is chosen

To draw a limit set you need a point *on* it. The default everywhere is
**`seedFromLoxodromic`**: search the word tree for the shortest word whose
spectrum (char poly + complex roots) certifies it loxodromic, then power-iterate
to its attracting fixed point. A family wanting a specific, stable word (e.g.
across a live parameter sweep) uses **`seedFromWord`** as an override. Both return
a `Seed`, so callers treat them uniformly.

---

## Demos

Run any of these with `npm run dev <name>` (see [Quick start](#quick-start)).

- **`hypergeometric-atlas`** — every hypergeometric monodromy group of degree ≤ 6
  (the full (α, β) classification lists), one table per degree + invariant-form
  type, from O(1) up to Sp(6,ℝ).
- **`hypergeometric-deg7`** — the same viewer on the degree 7 lists: 509 groups in
  O(4,3) · O(5,2) · O(6,1) · O(7), limit sets in RP⁶. (Both demos are one call to
  `src/app/hypergeometricAtlas.ts`, differing only in catalog.)
- **`o5-explorer`** — the full degree-5 orthogonal atlas (77 Bajpai–Singh groups),
  filtered by status (thin / arithmetic / open / finite).
- **`sp6-explorer`** — the 88-group Bajpai–Doña–Nitsche symplectic catalog.
- **`sp6`** — featured symplectic examples with view export.
- **`allhalf-odd`**, **`allhalf-even`** — the generated all-half towers browsed by
  *degree* rather than by catalog row: one knob d, the geometry changing with its
  parity (free product of reflections vs. free group on a transvection).
- **`c32`** — the C-32 limit set with the ping-pong convex domain ℙ(K) overlaid
  (projected 1-skeleton wireframe + translucent silhouette).
- **`sp6-paper`**, **`sp6-paper-appendix`** — fixed figure sets for the Sp(6)
  thinness paper (the nine-panel comparison, and the eight still-open degree-5
  orthogonal groups the appendix resolves). Deliberately not browsers.
- **`sl3r`** — convex projective Coxeter triangle groups on RP².
- **`schwartz-pappus`** — modular-group Anosov reps swept along the duality curve;
  **`marked-boxes`** — the Pappus marked-box subdivision.
- **`sl4r`** — GL(4,ℝ) pairs on RP³; **`james-marit`** — the SO(2,1)
  Hitchin construction on RP³.
- **`sl7`** — SL(7,ℝ) three-involution Goldman–Parker groups in RP⁶;
  **`sl7-rp2`** — the same groups reduced to their invariant RP², where the
  restricted generators are honest projective reflections.
- **`galois-sl3`** — SL(3,ℤ[√d]) groups drawn in RP⁵ through the Galois embedding
  into SL(3)×SL(3), with a seed-mode switch (joined vs. single-factor basepoint).
- **`sl2c`** — Kleinian / quasifuchsian groups on CP¹.
- **`su21`** — the Goldman–Parker ideal-triangle ladder (A = 0 up
  through the critical A* and beyond) + C-Fuchsian examples on ∂CH² = S³;
  **`su21-triangle-groups`** — the finite-vertex (p,q,r) family swept by the
  mirror phase φ; **`su21-tetrahedra`** — ideal tetrahedra on ∂CH².

## Offline render

Each viewer's "copy view JSON for offline render" button writes a view preset
(`outputs/presets/<group>-view-preset.json`) via the dev-server middleware; the
matching script in `scripts/render/` reproduces that exact view at higher depth
and resolution (streaming DFS → accumulator → log/percentile tone-map → PNG).
Most are thin plugins over the shared `scripts/render/renderDriver.ts`, which is
where the flags and the two modes (view-preset vs. auto-fit) are documented:

```sh
node scripts/render/sp6.ts                    # default example, default depth
node scripts/render/sp6.ts c32 14 --splat 1
node scripts/render/o5-explorer.ts g48 18     # auto-fit mode (no preset)
```

PNGs land in `outputs/<family>/` (gitignored). Memory floor is ~48 bytes/BFS
node (depth 14 ≈ 460 MB); pass `node --max-old-space-size=8192 …` for deep runs.

---

## Adding a new example or family

1. **A new group in an existing catalog** — add a data row (α/β tuple, or explicit
   matrices). The recipe and demo already handle it.
2. **A new family** — create `src/examples/<family>/` with: a way to turn its data
   into matrices (or a bespoke `apply`), an embedding (or reuse a chart), a
   palette, and a one-line seed helper; then a thin `demos/<family>/main.ts`. Core
   stays untouched unless you need a genuinely new generic ability.

Litmus test: `core/` shows abilities and zero matrices; a family shows data and a
little glue; a new family is "implement these few things."

## Verification

Core engines and constructions are pinned by **tests** under `scripts/tests/` that
check results against a known answer or an independent reference (exact where
possible — e.g. the convex V→H engine against C-32's facets, the james-marit rep
against a re-derivation). Every family also runs a **startup validator**
(structural + dynamical checks) when its demo loads.

## Conventions

- Run scripts directly: `node scripts/<dir>/<x>.ts` (Node strips TypeScript),
  where `<dir>` is `render/` (offline renderers), `catalog/` (atlas generation +
  validation), `tests/` (correctness gates), or `research/`. Scripts use relative
  imports with `.ts` extensions; demos use the `@/` alias (→ `src/`, resolved by
  Vite) — `node` cannot resolve `@/`, so anything node runs must stay relative.
- Matrices are flat `Float64Array` internally; write them with `mat([[…]])`.
- Strict TypeScript (`verbatimModuleSyntax`, `erasableSyntaxOnly`): `import type`
  for type-only imports, no enums / parameter-properties.
- Renders default to a white background; fix visibility with gamma/tone, not a
  dark background.
