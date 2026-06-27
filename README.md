# limit-sets

Interactive browser viewers and offline high-resolution renderers for the
**limit sets** of finitely-generated matrix groups acting on projective space —
hypergeometric monodromy groups (orthogonal O(5) and symplectic Sp(6)), convex
projective and Anosov representations on RP², Kleinian groups on CP¹, SL(4,ℝ)
Hitchin reps on RP³, and the Schwartz–Pappus modular-group construction.

The code is written to read as close to the underlying mathematics as possible:
one generic engine draws every family, and each family contributes only its data
plus the small recipe that turns that data into a group action.

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
  `degree5-orthogonal.ts` (77 Bajpai–Singh groups, generated from CSV) and
  `degree6-symplectic.ts` (88 Bajpai–Doña–Nitsche groups + a `FEATURED`
  shortlist). One recipe, two data files; "O(5) vs Sp(6)" is emergent from the
  tuples.
- **`projective/`** — matrix groups on RP² / RP³. `rp2.ts` (shared sphere +
  affine-plane embeddings), `triangle-groups/` (Coxeter + 4-reflection reps),
  `rp3-pairs/` (GL(4,ℝ) pairs), `schwartz-pappus/` (the modular-group Pappus
  construction — both the `box.ts` subdivision presentation **and** the
  `matrices.ts`/`duality.ts`/`recipe.ts` Anosov-matrix presentation).
- **`kleinian/`** — Möbius groups on CP¹. Keeps a bespoke complex 2×2 `apply` (the
  complex matvec reads closer to the math than a realified 4×4); seeds with the
  complex dominance criterion.
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

`npm run dev <name>` to develop, `npm run build <name>` to bundle. The runner
rewrites the `<script>` tag in `index.html` to the chosen demo.

- **`o5-explorer`** — the full degree-5 orthogonal atlas (77 Bajpai–Singh groups),
  filtered by status (thin / arithmetic / open / finite).
- **`sp6-explorer`** — the 88-group Bajpai–Doña–Nitsche symplectic catalog.
- **`sp6-limit-sets`** — featured symplectic examples with view export.
- **`c32`** — the C-32 limit set with the ping-pong convex domain ℙ(K) overlaid
  (projected 1-skeleton wireframe + translucent silhouette).
- **`sl3r-limit-sets`** — convex projective Coxeter triangle groups on RP².
- **`schwartz-pappus`** — modular-group Anosov reps swept along the duality curve;
  **`marked-boxes`** — the Pappus marked-box subdivision.
- **`sl4r-limit-sets`** — GL(4,ℝ) pairs on RP³; **`james-marit`** — the SO(2,1)
  Hitchin construction on RP³.
- **`sl2c-limit-sets`** — Kleinian / quasifuchsian groups on CP¹.

## Offline render

Each viewer's "copy view JSON for offline render" button writes a view preset
(`scripts/<group>-view-preset.json`) via the dev-server middleware; the matching
render script reproduces that exact view at higher depth and resolution
(streaming DFS → accumulator → log/percentile tone-map → PNG):

```sh
node scripts/sp6-render-limit-set.ts                 # default depth
node scripts/sp6-render-limit-set.ts c32 14 --splat 1
node scripts/o5-render-limit-set.ts g48 18           # auto-fit mode (no preset)
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

- Run scripts directly: `node scripts/<x>.ts` (Node strips TypeScript). Scripts
  use relative imports with `.ts` extensions; demos use the `@/` alias (→ `src/`,
  resolved by Vite).
- Matrices are flat `Float64Array` internally; write them with `mat([[…]])`.
- Strict TypeScript (`verbatimModuleSyntax`, `erasableSyntaxOnly`): `import type`
  for type-only imports, no enums / parameter-properties.
- Renders default to a white background; fix visibility with gamma/tone, not a
  dark background.
