# CLAUDE.md — working in this codebase

Limit-set viewers/renderers for matrix groups on projective space. The goal is
code that reads as close to the math as possible: one generic engine, families
that contribute only data + a thin recipe. See `README.md` for the user-facing
overview; this file is the rules for editing.

## The layering (respect it)

```
src/core/      generic abilities — NO example data, no group-specific constants
src/examples/  catalogs (data) + recipes (data → GroupAction), named by the math
src/render/    offline rasterization (accumulator, tone-map, PNG)
src/app/       live three.js (App, ControlPanel, meshes)
demos/         thin wiring: pick an example, build action, orbit, embed, render
scripts/       CLI tools — render/ (offline renderers) · catalog/ (o5 atlas
               gen + validate) · tests/ (correctness gates) · run-demo.mjs
```

- **Putting a matrix or coefficient list in `core/` is a mistake.** Core is
  abilities only. Specific groups live in `examples/`.
- **A recipe is a USE of core, not core.** It carries no data either — it turns a
  catalog row into a `GroupAction`.
- Demos are wiring. If a demo grows real math, that math belongs in its
  `examples/` module.

## Key abstractions

- **`GroupAction`** (`core/group.ts`): `apply(g, src,sOff, dst,dOff)` = `dst =
  g·src`; `inverse[g]`; optional `normalize`. Everything downstream consumes this.
- **`makeMatrixAction(alphabet)`** (`core/matrixAction.ts`): the matrix engine.
  The alphabet is the group-theoretic choice — `asInvolutions`,
  `pairWithInverses`, or `generatingSet([{M, involution?}])`. Dimension inferred.
- **`Mat`** (`core/matrix.ts`): flat row-major `Float64Array`, `n = √length`.
  Author with `mat([[…]])`. Generic `matMul/matInverse/matDet/matScale/matSub/
  companion`. Do not reintroduce nested `Mat3R`/`Mat4R` types.
- **Recipes** (`examples/<family>/recipe.ts`): `…Action(...)` builds the action;
  a `seed…(action)` helper chooses the basepoint. The hypergeometric recipe is
  the model (`hypergeometricAction(α, β, walk)`).
- **Seeding** (`core/seed.ts`): default `seedFromLoxodromic(action, …)` (auto,
  certified); override `seedFromWord(action, word, …)` (explicit). Both return a
  `Seed`. Kleinian uses `complexDominantCriterion`.
- **`SceneEmbedding`** (`core/scene.ts`): ℝⁿ→ℝ³, the only place a group's geometry
  meets the picture. Charts in `core/chart.ts`; RP² sphere/plane in
  `examples/projective/rp2.ts`.

## Conventions / gotchas

- **Run scripts:** `node scripts/<x>.ts` (Node 25 strips TS). Scripts use
  **relative imports with `.ts` extensions**; demos use the **`@/` alias** (→
  `src/`, Vite-only). `node` cannot resolve `@/`, so anything node runs (scripts,
  tests) must use relative `.ts` paths.
- **Strict TS:** `verbatimModuleSyntax` + `erasableSyntaxOnly`. Use `import type`
  for type-only imports; no enums, no constructor parameter-properties,
  `noUnusedLocals/Parameters`.
- **In-place `apply`:** `makeMatrixAction`'s apply snapshots `src` into a scratch
  buffer, so `apply(g, buf,0, buf,0)` (power iteration) is safe.
- **Stable identifiers (hard constraint):** view-preset JSON shape, the
  per-demo **group tags** in `vite.config.ts` `ALLOWED_GROUPS`, and example **`id`
  strings** must not change — saved presets key off them. (E.g. the renamed
  `demos/james-marit/` still uses tag `'james-marit-new'`.)
- **Renders default to white background.** Fix dim limit sets via gamma/tone, not
  a dark background. `outputs/` is the gitignored render workspace (PNGs +
  `outputs/cache/` accumulator caches + `outputs/presets/` saved framings).
- **Pin core math with a test.** When changing a core engine or construction, add
  a `scripts/tests/*.ts` that checks the result against a known answer or an
  independent reference (exact / ≤1e-12 where possible). When an intended change
  shifts the bits (e.g. auto-seeding picks a different word), spot-check that the
  limit set is unchanged (orbit bbox) and say so.

## Build / verify

```sh
npm run build <demo>      # vite production build (proves the demo loads)
npx tsc --noEmit          # typecheck (3 known pre-existing errors: limitSetMesh, textOverlay×2)
node scripts/tests/<gate>.ts
```

## Status (mid-refactor)

A large clarity refactor is nearly complete; see `REFACTOR_PLAN.md`. Migrated
families live in `examples/`. **Leftover old dirs still being removed:**
`src/o5/`, `src/sp6/` (used only by the `c32` demo + parity scaffolds — deleted
once c32 migrates), and `src/sl2c/` (fully dead, deletable with its parity test).
Do not build new work on those dirs.
