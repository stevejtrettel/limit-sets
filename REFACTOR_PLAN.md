# Limit-Sets Refactor Plan

**Status:** DRAFT for review — no code is to be written until this plan is accepted.
**Goal:** Reorganize `src/` so that (1) the pure, generic mathematics lives in one
clearly-marked place, (2) what a new example/catalog must supply is razor-sharp and
minimal, and (3) the code reads as close to the underlying math as possible.

This is a *clarity* refactor, not a feature change. Every picture the repo can draw
today it must still draw after. The win is structural: less duplicated math, a single
matrix-action engine, catalogs that are data + a thin recipe, and demos that are pure
wiring.

---

## 1. Principles (the contract this plan must honor)

1. **Generic tools are a library, never a framework.** `makeMatrixAction`, the
   loxodromic seed search, the chart fitters — all are things a catalog *imports and
   uses*, not machinery it is forced through. A catalog with unusual needs may write
   its own `apply` against the `GroupAction` interface directly (as `kleinian` will).
2. **`core/` holds abilities, never data.** No example matrices, no coefficient lists,
   no dimension constants tied to a particular group. If it names a specific group, it
   does not belong in `core/`.
3. **Catalogs are named by the mathematics they catalog**, not by the first demo that
   used them (`hypergeometric`, not `o5`/`sp6`).
4. **A generating set is data that belongs to the example.** A catalog exposes a *menu*
   of named generating sets (e.g. `free`, `free-product`) and names a default; a demo
   may pick another to compare. (Motivated by real needs: verifying two walks agree,
   group-vs-subgroup, thin-vs-arithmetic comparison.)
5. **Loxodromic seeding is the default, not a requirement.** Every real-spectrum family
   uses the generic certified-loxodromic search to find its basepoint; any example may
   override with an explicit word or hand-picked basepoint when the math calls for it.
6. **The app stays working at every phase.** Migration is incremental and each phase
   ends green (validation passes, demos build, representative renders verified).

---

## 2. Target architecture

```
src/
  core/                 PURE ABILITIES — no example data, no group-specific dimension
    group.ts              GroupAction interface                                  (keep)
    matrix.ts             Mat type + mat()/matMul/matInverse/matDet/matTrace/
                          identity/companion                                     (NEW)
    matrixAction.ts       makeMatrixAction, Alphabet, generatingSet,
                          asInvolutions, pairWithInverses, normalizeSphere       (NEW)
    polynomial.ts         Rotation, parseRotation, cyclotomicProduct             (NEW; was sp6/hypergeometric.ts)
    linalg.ts             jacobiSymmetricEig, charPoly, polyRoots, Complex       (keep; spectral half)
    seed.ts               wordMatrix, wordEigenvalues, criteria,
                          findLoxodromicWord, seedFromLoxodromic, formatWord     (= today's loxodromic.ts + genericized o5/seed.ts)
    orbit.ts              BFS/DFS walkers, computeProximalBasepoint              (keep)
    subdivision.ts        n-ary subdivision-tree walker                          (keep)
    chart.ts              generic projective charts (axis/PCA/auto)              (keep; stateDim inference tweak)
    scene.ts              SceneEmbedding, composeProjector, embedOrbit           (keep)
    camera.ts             cameras + bbox autofit                                 (keep)
    projector.ts          preset/auto projector orchestration                    (keep)
    viewPreset.ts         camera/viewport/projection contracts +
                          embeddingFromPreset (dim inferred) + ChartViewPreset/
                          NamedViewPreset bundle types                           (keep; generalized)
    validation.ts         runValidation harness                                  (keep)

  examples/             RECIPES + CATALOGS — data + thin math glue, named by the math
    hypergeometric/
      recipe.ts           hypergeometricMatrices, hypergeometricWalks,
                          hypergeometricAction                                   (NEW; merges o5+sp6 action logic)
      degree5-orthogonal.ts   ORTHOGONAL_DEGREE5 (77 rows)                       (← o5/catalog.ts)
      degree6-symplectic.ts   SYMPLECTIC_DEGREE6 (88 rows + 6 curated overrides) (← sp6/catalog.ts + examples.ts)
      validate.ts         structural (self-reciprocal / palindromic) + dynamical (← merge o5+sp6 validate)
    projective/           explicit-matrix groups acting on RP^{n-1}
      triangle-groups/    coxeter-334.ts, four-reflection.ts, EXAMPLES          (← sl3r/examples.ts)
      rp3-pairs/          pair data + custom charts, EXAMPLES                     (← demos/sl4r-limit-sets/pair1.ts + sl4r/types.ts)
      embeddings.ts       sphere + affine-plane (RP² fixed embeddings)           (← sl3r/embedding.ts, generalized)
    kleinian/             Möbius on CP¹ (keeps bespoke complex apply)
      action.ts           makeMobiusAction, ComplexMat2                          (← sl2c/action.ts)
      embedding.ts        Hopf sphere + stereographic plane                      (← sl2c/embedding.ts)
      examples.ts, validate.ts                                                   (← sl2c/*)
    schwartz-pappus/      Pappus subdivision + Anosov matrices
      box.ts, duality.ts, matrices.ts, validate.ts                              (← schwartz-pappus/*, rewired to core/matrix)

  render/               VISUALIZATION (offline): accumulator, png, tone, splat … (keep, unchanged)
  app/                  VISUALIZATION (live three.js): App, ControlPanel, meshes (keep, unchanged)

demos/                  CONCRETE INSTANCES — pick a catalog row + walk + embedding + camera, render
```

Palettes (currently `*/palettes.ts`, 5-entry RGB per family) are *viewing data*, not
math. They move beside their catalog under `examples/<cat>/palette.ts`, or — since
several are near-identical (`sp6`, `sl4r` share the A/A⁻¹/B/B⁻¹ convention) — into a
small shared `app/palettes.ts`. Lowest stakes; decided in Phase 7.

---

## 3. Core API specifications (new + changed modules)

### 3.1 `core/matrix.ts` (NEW)

Absorbs every per-family matrix algebra helper: o5's `companion`/`companionInverse`/
`mul5`, sl3r's `mat3Det`/`mat3Inverse`, sl4r's `mat4Det`/`mat4Mul`/`mat4Inverse`,
schwartz-pappus's `mat3Mul`/`mat3Inv`/`mat3Trace`.

```ts
/** Row-major n×n matrix; n = √length, inferred everywhere. */
export type Mat = Float64Array;

export function matDim(M: Mat): number;                 // √length, throws if non-square
export function mat(rows: readonly (readonly number[])[]): Mat;   // human [[…]] → flat
export function identity(n: number): Mat;
export function matMul(P: Mat, Q: Mat): Mat;            // dim inferred & checked equal
export function matDet(M: Mat): number;                 // generic (LU)
export function matInverse(M: Mat): Mat;                // generic Gauss–Jordan; throws if |det| < EPS
export function matTrace(M: Mat): number;

/** Companion matrix of a monic polynomial given high-degree-first
 *  coefficients [1, c_{n-1}, …, c₀] (length n+1). Convention (from o5/action.ts):
 *  C·e_j = e_{j+1} for j<n-1; last column = −(c₀,…,c_{n-1})ᵀ. */
export function companion(coeff: readonly number[]): Mat;
```

Notes:
- One generic `matInverse` (Gauss–Jordan) replaces five hand-rolled inverses. o5's
  closed-form `companionInverse` is dropped; `matInverse(companion(c))` suffices (all
  uses are float power-iteration anyway). Parity test guards this (§6).
- `EPS` for singularity matches existing `1e-15`.

### 3.2 `core/matrixAction.ts` (NEW)

The single projective matrix-action engine. Replaces `makeMat3Action`, `makeMat4Action`,
o5's matrix-table action, and sp6's inlined-switch action.

```ts
export interface Alphabet {
  matrices: readonly Mat[];      // generator-code order
  inverse:  readonly number[];   // inverse[g] = code of g⁻¹
}

/** A generator either is an involution (its own inverse) or is paired with its
 *  computed inverse. The general primitive; the two helpers below are sugar. */
export interface Gen { M: Mat; involution?: boolean; }
export function generatingSet(gens: readonly Gen[]): Alphabet;

export function asInvolutions(mats: readonly Mat[]): Alphabet;     // each its own inverse
export function pairWithInverses(mats: readonly Mat[]): Alphabet;  // [g,g⁻¹,…] via matInverse

/** Sphere-normalize a state of dimension dim in place (replaces normalizeS2..S5). */
export function normalizeSphere(buf: Float64Array, off: number, dim: number): void;

/** Build the projective GroupAction. Dimension inferred from matrices[0].
 *  normalize defaults true (sphere-normalize after each apply). apply is the
 *  generic matvec loop (o5's current loop, dimension-generic). */
export function makeMatrixAction(
  alph: Alphabet,
  opts?: { normalize?: boolean },
): GroupAction;
```

Semantics of `generatingSet`: walk `gens`; an involution contributes one code `[M]`
with `inverse[code]=code`; a free generator contributes two codes `[M, matInverse(M)]`
with the two `inverse[]` entries swapped. Enforces the 255-code cap (BASEPOINT_SENTINEL).

`makeMatrixAction.apply` is the generic loop:
```ts
for (let r = 0; r < n; r++) {
  let acc = 0;
  for (let c = 0; c < n; c++) acc += M[r*n + c] * src[sOff + c];
  dst[dOff + r] = acc;
}
```
(V8 inlines this for small n; `chart.ts` already relies on the same pattern.)

### 3.3 `core/polynomial.ts` (NEW — relocation of `sp6/hypergeometric.ts`)

Pure ability, currently mis-homed inside `sp6/` and reached into by `o5/catalog.ts`.

```ts
export interface Rotation { num: number; den: number; }
export function parseRotation(s: string): Rotation;
export function parseRotations(rs: readonly (string | Rotation)[]): Rotation[];

/** ∏(x − e^{2πi rⱼ}) as integer coefficients, high-degree-first (length n+1).
 *  Renamed from polynomialFromRotationStrings for a clearer mathematical name. */
export function cyclotomicProduct(rots: readonly (string | Rotation)[]): number[];
```

Keep `INT_EPS`/`snapToInt` internal. The two old call sites (`o5/catalog`,
`sp6/catalog`) are replaced by the hypergeometric recipe (§4.1).

### 3.4 `core/seed.ts` (rename of `loxodromic.ts`, + genericized `o5/seed.ts`)

```ts
// unchanged from loxodromic.ts:
export function wordMatrix(action: GroupAction, word: readonly number[]): number[][];
export function wordEigenvalues(action: GroupAction, word: readonly number[]): Complex[];
export type LoxodromicCriterion = (eigs: Complex[]) => number | null;
export const realDominantCriterion: LoxodromicCriterion;
export const complexDominantCriterion: LoxodromicCriterion;
export interface LoxodromicWord { word: number[]; lambdaMax: number; }
export function findLoxodromicWord(action, opts?): LoxodromicWord | null;

// promoted from o5/seed.ts, made generic:
export interface Seed {
  basepoint: Float64Array; word: number[]; name: string;
  lambdaMax: number; drift: number; fallback: boolean;
}
/** Find the shortest certified loxodromic word and power-iterate to its
 *  attracting fixed point. Falls back to `fallbackWord` (e.g. a parabolic γ)
 *  if no loxodromic is found within maxLen. `labels` names generators for display. */
export function seedFromLoxodromic(action: GroupAction, opts?: {
  iters?: number; maxLen?: number; criterion?: LoxodromicCriterion;
  fallbackWord?: readonly number[]; labels?: readonly string[];
}): Seed;

/** Reverse an apply-order word to a group element and pretty-print with run-length
 *  exponents, using `labels` (generic version of o5's formatWord). */
export function formatWord(word: readonly number[], labels: readonly string[]): string;
```

`o5`'s parabolic-TB fallback and `T/B/B⁻¹` labels become arguments supplied by the
hypergeometric recipe, not baked into core.

### 3.5 `core/viewPreset.ts` (generalized)

- `makeChartFromData` / `makeEmbeddingFactory` infer `stateDim` from `denom.length`,
  so the four `*/embedding.ts` stubs (`O5_STATE_DIM` etc.) collapse into one generic
  `embeddingFromPreset(p: ViewPresetProjection): ChartEmbedding`.
- Add the two shared bundle types the families currently each redeclare:
  ```ts
  export interface ChartViewPreset {        // o5, sp6, sl4r
    exampleId: string; previewDepth: number; colorScheme?: string;
    projection: ViewPresetProjection; camera: ViewPresetCamera; viewport: ViewPresetViewport;
  }
  export interface NamedViewPreset {        // sl2c, sl3r
    exampleId: string; previewDepth: number; colorScheme?: string;
    embedding: string; camera: ViewPresetCamera; viewport: ViewPresetViewport;
  }
  ```
  **On-disk JSON shape is unchanged** — this only de-duplicates the TS types. Saved
  preset files keep working (critical; see §5.3).

---

## 4. Examples layer specifications

### 4.1 `examples/hypergeometric/` (merges `o5` + `sp6`)

**recipe.ts** — the only place the companion construction + walk menu lives:
```ts
import { companion, matMul, matInverse, mat } from '../../core/matrix';
import { makeMatrixAction, generatingSet, pairWithInverses, Alphabet } from '../../core/matrixAction';
import { cyclotomicProduct } from '../../core/polynomial';

export type Walk = 'free' | 'free-product';

export function hypergeometricMatrices(alpha: string[], beta: string[]): { A: Mat; B: Mat } {
  return { A: companion(cyclotomicProduct(alpha)), B: companion(cyclotomicProduct(beta)) };
}

export const hypergeometricWalks: Record<Walk, (m: { A: Mat; B: Mat }) => Alphabet> = {
  'free':         ({ A, B }) => pairWithInverses([A, B]),                 // {A,A⁻¹,B,B⁻¹}
  'free-product': ({ A, B }) => generatingSet([                          // {T, B}, T=BA⁻¹ involution
                     { M: matMul(B, matInverse(A)), involution: true },   //   (Bajpai–Nitsche Thm 1)
                     { M: B },
                  ]),
};

export function hypergeometricAction(alpha: string[], beta: string[], walk: Walk = 'free'): GroupAction {
  return makeMatrixAction(hypergeometricWalks[walk](hypergeometricMatrices(alpha, beta)));
}
```
The `T² = I` assertion (a runtime check that `free-product` is legitimate for the given
data) lives here.

**Row type** (shared by both catalogs; catalog-specific fields optional):
```ts
export interface HyperRow {
  no: number; id: string; label: string;
  status: 'thin' | 'arithmetic' | 'open' | 'finite';
  source?: string;
  alpha: readonly string[]; beta: readonly string[];
  // optional overrides / catalog-specific:
  seedWord?: readonly number[];     // pin an exact basepoint word (else auto-seed)
  expectedLambdaMax?: number;       // validation cross-check (sp6 curated set)
  // degree-5 orthogonal extras:
  formType?: 'O(3,2)' | 'O(4,1)' | 'O(5)';
  bdn?: string;
}
```
Coefficient lists are **no longer stored** — they are derived on demand via
`cyclotomicProduct` (eliminates the `rowToExample` derivation step; the structural
validator computes them when checking self-reciprocity).

**degree5-orthogonal.ts** — `ORTHOGONAL_DEGREE5 = { defaultWalk: 'free-product', rows: HyperRow[] }`
(77 rows, regenerated by `scripts/gen-o5-catalog.ts`; see §5.4).

**degree6-symplectic.ts** — `SYMPLECTIC_DEGREE6 = { defaultWalk: 'free', rows: HyperRow[] }`
(88 catalog rows; the 6 previously-curated examples become rows carrying
`expectedLambdaMax` and, if we want to reproduce old renders exactly, `seedWord: [1,2,2,1,2]`).

**validate.ts** — one validator, parameterized by `degree` (5 ⇒ self-reciprocal i.e.
palindromic-or-antipalindromic; 6 ⇒ palindromic), reusing `runValidation` and
`seedFromLoxodromic` for the dynamical half. Replaces both `o5/validate.ts` and
`sp6/validate.ts`.

### 4.2 `examples/projective/` (merges `sl3r` + `sl4r`)

Explicit-matrix groups acting on RP^{n-1}. **No recipe module needed** — the
generating-set menu is the two core builders. A demo/catalog row builds its action with:
```ts
const action = makeMatrixAction(ex.involutions ? asInvolutions(ex.generators)
                                               : pairWithInverses(ex.generators));
```
Catalog data:
- **triangle-groups/** — `coxeter-334.ts` (the `triangle334Matrices(d)` builder and its
  `EXAMPLES`), `four-reflection.ts`, plus `makeLiveTri334(d)` for the browser slider.
  Generators are now `Mat` (flat), built with `mat([[…]])`.
- **rp3-pairs/** — the `SL4RExample` data currently stranded in
  `demos/sl4r-limit-sets/pair1.ts`, plus the `CustomChart` type. Moves into the library
  so the render script no longer reaches into `demos/`.
- **embeddings.ts** — RP² `sphereEmbedding` (identity) and `planeEmbedding`
  (affine `x/z,y/z`). The sphere case is generic; `planeEmbedding` is
  `makeAxisChartEmbedding`-expressible, so this file may shrink to thin wrappers.

Example row type (shared, flat-matrix):
```ts
export interface MatrixGroupExample {
  id: string; label: string; description: string;
  generators: readonly Mat[]; involutions: boolean;
  seedWord?: readonly number[];            // optional; else auto-seed
  customCharts?: readonly CustomChart[];   // rp3 only
}
```
Note: `gamma`/`gammaName`/`powerIter` fields are dropped in favor of `seedFromLoxodromic`
(with `seedWord` as the override when an exact historical basepoint is wanted).

### 4.3 `examples/kleinian/` (relocates `sl2c`, mostly unchanged)

Keeps its **bespoke complex `apply`** (`makeMobiusAction`, `ComplexMat2`) — the complex
2×2 matvec reads closer to the math than a realified 4×4 would; this is the sanctioned
"write your own action when it's clearer" case. Imports `normalizeSphere` from core.
`embedding.ts` (Hopf + stereographic) and `examples.ts` (7 groups) move verbatim.
`validate.ts` keeps its closed-form λ_max cross-check.

**Open follow-up (non-blocking):** wire `complexDominantCriterion` + a complex
power-iteration step so kleinian can also use generic loxodromic seeding. Until then it
keeps its hand `gamma` words. Tracked as a separate task, not part of the structural
migration.

### 4.4 `examples/schwartz-pappus/` (rewired to core)

`box.ts` (Pappus subdivision) is already core-clean (`subdivideTree`). `matrices.ts`,
`duality.ts`, `validate.ts` move verbatim except: replace the `import { Mat3R, mat3Det }
from '../sl3r/action'` and local `mat3Mul/mat3Inv/mat3Trace` with `core/matrix`
(`Mat`, `matDet`, `matMul`, `matInverse`, `matTrace`). Generators become flat `Mat`.

---

## 5. Cross-cutting concerns

### 5.1 Matrix representation: flat `Float64Array` + `mat([[…]])`

Decided. Internals are flat row-major (`Mat = Float64Array`), dimension inferred from
length — this unifies with state vectors, lets `matMul`/`matInverse`/`companion`/
`makeMatrixAction` be dimension-generic, and is cache-friendly. Human-authored matrices
(in `examples/`) are written with `mat([[1,0,0],[0,-1,0],[0,0,1]])`, recovering full
readability where matrices are actually typed. The old nested `Mat3R`/`Mat4R` tuple
types are retired.

### 5.2 The `@/` path alias

All consumers import via the `@/` alias (e.g. `@/o5/action`). After migration the alias
targets change: `@/o5/*` and `@/sp6/*` → `@/examples/hypergeometric/*`; `@/sl3r/*`,
`@/sl4r/*` → `@/examples/projective/*`; `@/sl2c/*` → `@/examples/kleinian/*`;
`@/schwartz-pappus/*` → `@/examples/schwartz-pappus/*`; `@/core/*` unchanged. Every
import line in §7's call-site table is rewritten accordingly. The alias root in
`tsconfig`/`vite.config` is unchanged (still `src/`).

### 5.3 View-preset JSON backward compatibility (hard constraint)

`vite.config.ts` `ALLOWED_GROUPS` and the on-disk `scripts/<group>-view-preset.json`
files key off **group tag strings** (`'o5'`, `'sp6'`, `'sl2c'`, `'sl3r'`, `'sl4r'`,
`'james-marit'`, `'james-marit-new'`, `'schwartz-pappus'`, `'marked-boxes'`,
`'sp6c32'`). These are serialization identifiers, decoupled from directory names:
- **Keep the group tags exactly as they are.** Renaming code dirs does not rename tags.
- **Keep every example `id` string stable** across the move (presets reference
  `exampleId`). The migration must preserve ids verbatim.
- The projection round-trip (`denom`/`rowX/Y/Z`) and named-embedding presets keep their
  exact JSON shape (§3.5). Saved views continue to load.

A regression check (§6) loads each existing `scripts/*-view-preset.json` post-migration
and confirms it still resolves to a renderable projector.

### 5.4 Generated catalog (`scripts/gen-o5-catalog.ts`)

Currently emits `o5/catalog.ts` from `orthogonal_hypergeometric_group_tables.csv`. Retarget
its output to `examples/hypergeometric/degree5-orthogonal.ts` and emit the new `HyperRow`
shape (rows of α/β only, no derived coefflists). Regenerate; diff the 77 rows for parity
on `(no, status, source, alpha, beta)`.

### 5.5 Seeding change → picture change (expected, controlled)

Switching `sp6`/`sl3r`/`sl4r` from hand-`gamma` to `seedFromLoxodromic` may land the
basepoint on a *different point of the same limit set*. The closure is identical; a
finite-depth sampling differs. Therefore **image parity is not a valid migration gate
where seeding changes.** Mitigation: each affected example may carry `seedWord` pinned to
its historical word, reproducing the old basepoint exactly when desired. Default behavior
uses the certified auto-seed; the structural gate is action-matrix parity + a certified
loxodromic basepoint (drift small, |λ|>1), with a user visual spot-check.

---

## 6. Verification strategy

A parity harness is the backbone — it lets each phase prove "new == old" before deletion.

1. **Matrix-algebra parity.** For random matrices in dims 2–6: `matInverse`·M ≈ I;
   `matMul` associativity; `companion` spectrum matches `polyRoots(charPoly)`; new
   `matInverse(companion(c))` ≈ old `companionInverse(c)` (< 1e-10).
2. **Action parity (per existing example, before deleting its old factory).** Build old
   and new `GroupAction`; assert identical `numGenerators`, `stateDim`, `inverse`; and
   for 1000 random unit vectors, `apply(g, ·)` agrees within 1e-12 for every generator
   `g`. (Flat-vs-nested matvec may reorder float ops; tolerance, not bit-equality.)
3. **Spectrum/seed parity.** For each example, `wordEigenvalues` of a fixed test word
   matches old; `seedFromLoxodromic` returns a basepoint with drift < tol and |λ| > 1.
4. **Polynomial parity.** All 77 + 88 catalogs: `cyclotomicProduct(α)` equals the
   previously stored coefflist exactly (integers).
5. **Existing validators pass.** Each migrated catalog's `validateAllExamples` runs
   clean at app startup (these are already end-to-end checks).
6. **View-preset regression.** Every `scripts/*-view-preset.json` still loads and yields
   a projector post-migration.
7. **Render spot-check.** For a handful of representative examples per catalog, render at
   a fixed depth with a *pinned* `seedWord` (so the basepoint is identical) and compare
   the PNG to a pre-migration baseline within a small pixel-diff threshold. Where seeding
   intentionally changes, replace with a user visual check.

Parity tests live under `scripts/parity/` (or a `test/` dir) and are deleted with the old
code once a phase is green.

---

## 7. Per-file migration map

Legend: **MOVE** (relocate ~verbatim) · **MERGE** (fold into a shared module) ·
**SPLIT** · **GENERICIZE** · **DELETE** (after parity green) · **KEEP**.

### core/
| Current | Action | Target |
|---|---|---|
| core/group.ts | KEEP | core/group.ts |
| core/linalg.ts | KEEP (spectral) | core/linalg.ts |
| core/loxodromic.ts | RENAME + extend | core/seed.ts |
| core/orbit.ts | KEEP | core/orbit.ts |
| core/subdivision.ts | KEEP | core/subdivision.ts |
| core/chart.ts | KEEP (+stateDim infer) | core/chart.ts |
| core/scene.ts | KEEP | core/scene.ts |
| core/camera.ts | KEEP | core/camera.ts |
| core/projector.ts | KEEP | core/projector.ts |
| core/viewPreset.ts | GENERICIZE | core/viewPreset.ts |
| core/validation.ts | KEEP | core/validation.ts |
| — | NEW | core/matrix.ts |
| — | NEW | core/matrixAction.ts |
| — | NEW (from sp6/hypergeometric) | core/polynomial.ts |

### o5/ → examples/hypergeometric/
| Current | Action | Target |
|---|---|---|
| o5/action.ts (`makeO5Action`, `companion`, `companionInverse`, `mul5`, `buildO5Matrices`) | MERGE → core/matrix + recipe | core/matrix.ts, examples/hypergeometric/recipe.ts |
| o5/catalog.ts (77 rows) | MOVE (regenerated) | examples/hypergeometric/degree5-orthogonal.ts |
| o5/types.ts (`O5Example`,`O5Type`,`O5Status`) | MERGE | examples/hypergeometric (HyperRow) |
| o5/seed.ts (`loxodromicSeed`,`formatWord`) | GENERICIZE → core | core/seed.ts |
| o5/validate.ts | MERGE | examples/hypergeometric/validate.ts |
| o5/embedding.ts (`O5_STATE_DIM`) | DELETE | core/viewPreset embeddingFromPreset |
| o5/palettes.ts | MOVE | examples/hypergeometric/palette.ts (or app/palettes) |
| o5/viewPreset.ts (`ViewPreset`) | MERGE | core ChartViewPreset |

### sp6/ → examples/hypergeometric/
| Current | Action | Target |
|---|---|---|
| sp6/action.ts (`makeSp6Action`, inlined) | MERGE → recipe (`free` walk) | examples/hypergeometric/recipe.ts |
| sp6/hypergeometric.ts | MOVE → core | core/polynomial.ts |
| sp6/catalog.ts (88 rows) | MOVE | examples/hypergeometric/degree6-symplectic.ts |
| sp6/examples.ts (6 curated + `Sp6Example`) | MERGE (as rows w/ overrides) | examples/hypergeometric/degree6-symplectic.ts |
| sp6/validate.ts | MERGE | examples/hypergeometric/validate.ts |
| sp6/embedding.ts (`SP6_STATE_DIM`) | DELETE | core/viewPreset |
| sp6/palettes.ts | MOVE | examples/hypergeometric/palette.ts (or app/palettes) |
| sp6/viewPreset.ts | MERGE | core ChartViewPreset |

### sl3r/ + sl4r/ → examples/projective/
| Current | Action | Target |
|---|---|---|
| sl3r/action.ts (`makeMat3Action`, `mat3Det`, `mat3Inverse`) | MERGE → core | core/matrix.ts + core/matrixAction.ts |
| sl3r/examples.ts (`SL3RExample`, 6 ex + builders) | MOVE | examples/projective/triangle-groups/* |
| sl3r/embedding.ts (sphere/plane) | GENERICIZE | examples/projective/embeddings.ts |
| sl3r/validate.ts | MERGE → shared matrix-group validator | examples/projective/validate.ts |
| sl3r/palettes.ts | MOVE | examples/projective/palette.ts (or app/palettes) |
| sl3r/viewPreset.ts | MERGE | core NamedViewPreset |
| sl4r/action.ts (`makeMat4Action`, `mat4Det/Mul/Inverse`) | MERGE → core | core/matrix.ts + core/matrixAction.ts |
| sl4r/types.ts (`SL4RExample`,`CustomChart`) | MOVE | examples/projective/rp3-pairs/* |
| demos/sl4r-limit-sets/pair1.ts (EXAMPLES) | MOVE into library | examples/projective/rp3-pairs/examples.ts |
| sl4r/embedding.ts (`SL4R_STATE_DIM`) | DELETE | core/viewPreset |
| sl4r/validate.ts | MERGE → shared matrix-group validator | examples/projective/validate.ts |
| sl4r/palettes.ts | MOVE | examples/projective/palette.ts (or app/palettes) |
| sl4r/viewPreset.ts | MERGE | core ChartViewPreset |

### sl2c/ → examples/kleinian/ (mostly verbatim)
| Current | Action | Target |
|---|---|---|
| sl2c/action.ts (`makeMobiusAction`,`ComplexMat2`) | MOVE (keep bespoke) | examples/kleinian/action.ts |
| sl2c/embedding.ts | MOVE | examples/kleinian/embedding.ts |
| sl2c/examples.ts | MOVE | examples/kleinian/examples.ts |
| sl2c/validate.ts | MOVE | examples/kleinian/validate.ts |
| sl2c/palettes.ts | MOVE | examples/kleinian/palette.ts |
| sl2c/viewPreset.ts | MERGE | core NamedViewPreset |

### schwartz-pappus/ → examples/schwartz-pappus/
| Current | Action | Target |
|---|---|---|
| schwartz-pappus/box.ts | MOVE | examples/schwartz-pappus/box.ts |
| schwartz-pappus/duality.ts | MOVE | examples/schwartz-pappus/duality.ts |
| schwartz-pappus/matrices.ts (imports sl3r) | REWIRE → core/matrix | examples/schwartz-pappus/matrices.ts |
| schwartz-pappus/validate.ts | REWIRE → core/matrix | examples/schwartz-pappus/validate.ts |

---

## 8. Call-site change map (demos + scripts)

25 consumers. Every change is an import-path rewrite plus, for action construction, a
swap to `makeMatrixAction`/recipe. No demo's *behavior* changes.

**Hypergeometric (o5+sp6) — 10 consumers.**
- `demos/o5-explorer/main.ts`: `makeO5Action` + `CATALOG_EXAMPLES` + `loxodromicSeed` →
  `hypergeometricAction(row.alpha,row.beta,ORTHOGONAL_DEGREE5.defaultWalk)` +
  `ORTHOGONAL_DEGREE5` + `seedFromLoxodromic`; validate/palette/viewPreset paths updated.
- `scripts/o5-render-limit-set.ts`, `scripts/o5-check-bs.ts`, `scripts/o5-verify-matrices.ts`,
  `scripts/gen-o5-catalog.ts`: swap `makeO5Action`/`buildO5Matrices`/`mul5` → recipe +
  `core/matrix` (`companion`,`matMul`,`matInverse`); `embeddingFromPreset` from core;
  `polynomialFromRotationStrings` → `cyclotomicProduct` from core.
- `demos/sp6-explorer/main.ts`, `demos/sp6-limit-sets/main.ts`, `scripts/sp6-render-limit-set.ts`:
  `makeSp6Action(ex)` → `hypergeometricAction(row.alpha,row.beta,'free')`; `EXAMPLES`/
  `CATALOG_EXAMPLES`/`exampleById` → `SYMPLECTIC_DEGREE6` rows + a local `byId` helper.
- `demos/c32/main.ts`, `demos/sp6-c32/main.ts`, `scripts/sp6-c32-render-hull.ts`,
  `scripts/sp6-c32-transform-rays.ts`: same `makeSp6Action`→recipe swap; these also use
  `computeProximalBasepoint` directly (keep) and chart fitters (unchanged). **Note:** the
  c32 work has its own background/hull machinery — verify the recipe's `free` action is
  matrix-identical to old `makeSp6Action` (parity test) before touching c32.

**Projective (sl3r) — 4 consumers.**
- `demos/sl3r-limit-sets/main.ts`, `scripts/sl3r-render-limit-set.ts`: `makeMat3Action` →
  `makeMatrixAction(asInvolutions(ex.generators))`; examples + embeddings + palette paths
  updated.
- `demos/schwartz-pappus/main.ts`, `scripts/schwartz-pappus-render-limit-set.ts` (mixed
  sl3r + schwartz-pappus): `makeMat3Action` + sl3r sphere/plane embeddings → new
  projective paths; `validatePappus` path updated.

**Projective (sl4r) — 6 consumers.**
- `demos/sl4r-limit-sets/main.ts`, `scripts/sl4r-render-limit-set.ts`: `makeMat4Action` →
  `makeMatrixAction(... pairWithInverses/asInvolutions)`; **EXAMPLES import moves from
  `demos/sl4r-limit-sets/pair1` → `examples/projective/rp3-pairs`** (fixes the script
  reaching into a demo dir).
- `demos/james-marit/main.ts`, `scripts/james-marit-render-limit-set.ts`,
  `demos/james-marit-new/main.ts`, `scripts/james-marit-new-render-limit-set.ts`: use
  `makeMat4Action` + `mat4Mul` + `mat4Inverse` directly → `makeMatrixAction` +
  `matMul`/`matInverse` from core; `SL4RExample` type from new location.

**Kleinian (sl2c) — 2 consumers.**
- `demos/sl2c-limit-sets/main.ts`, `scripts/sl2c-render-limit-set.ts`: import paths only
  (`@/sl2c/*` → `@/examples/kleinian/*`); API unchanged.

**Marked boxes — 2 consumers.**
- `demos/marked-boxes/main.ts`, `scripts/marked-boxes-render-limit-set.ts`: only
  `@/schwartz-pappus/box` → `@/examples/schwartz-pappus/box`. No action factory involved.

**Shared script util.** `scripts/renderDriver.ts` — re-point any family imports; otherwise
core-only.

---

## 9. Sequencing (each phase ends green)

Status markers: ✅ done · ◻ pending. Through the structural phases (1–5) the example
*types* ride along unchanged so each is a **pure structural move** verified by bit-exact
parity; the example-format + seeding redesign that *changes* those types is isolated to a
single late phase (Phase 7, §12).

- **Phase 0 — Core foundations (no consumer touched).** ✅ `core/matrix.ts`,
  `core/matrixAction.ts`, `core/polynomial.ts` added; `loxodromic.ts`→`seed.ts` + shim;
  `core/viewPreset.ts` generalized; `scripts/parity/action-parity.ts` lands. Bit-identical
  across o5/sp6/sl3r.
- **Phase 1 — Triangle groups (sl3r → `examples/projective/triangle-groups`).** ✅
  `data.ts`/`embeddings.ts`/`palette.ts`/`validate.ts`/`viewPreset.ts` built on core;
  `sl3r-limit-sets` demo + render script migrated; bit-identical parity (apply + seed).
  **`src/sl3r/` NOT deleted** — schwartz-pappus still depends on it (deletion deferred to
  Phase 5).
- **Phase 2 — Hypergeometric (o5 + sp6), split into reviewable check-ins:**
  - **2a — o5 (degree-5 orthogonal).** ✅ `examples/hypergeometric/` recipe + generated
    `degree5-orthogonal.ts` + validate + palette + viewPreset; `gen-o5-catalog.ts`
    retargeted; all 5 o5 consumers migrated; bit-identical across all 77 groups.
  - **2b — sp6 (degree-6 symplectic).** ✅ `degree6-symplectic.ts` (88 catalog + 6 curated)
    + `symplecticAction` adapter + symplectic validator; palette matched; `sp6-explorer`,
    `sp6-limit-sets`, `sp6-render` migrated; bit-identical across 88 + 6.
  - **2c — c32 family + dir deletion.** ⏸ DEFERRED (user's call). The c32/sp6-c32 demos
    + hull scripts are bespoke, actively-developed work; the user will first decide which
    c32 variants to keep, then migrate. `src/o5/` and `src/sp6/` stay in place meanwhile —
    harmless (all demos build), still imported only by the c32 family + parity tests. The
    o5/sp6 dir deletion waits on this.
- **Phase 3 — Projective RP³ (sl4r) + james-marit.** ◻ Move `pair1.ts` into the library;
  migrate 6 consumers; parity + spot-check; delete `sl4r/`.
- **Phase 4 — Kleinian (sl2c).** ◻ Mechanical relocation; migrate 2 consumers. Delete
  `sl2c/`. (Complex loxodromic seeding deferred to Phase 7.)
- **Phase 5 — Schwartz-Pappus rewire + sl3r teardown.** ◻ Re-point `matrices.ts`/
  `validate.ts` to `core/matrix`; migrate the schwartz-pappus demo+script off
  `makeMat3Action`/sl3r embeddings; migrate marked-boxes import paths; run `validatePappus`.
  **Then delete `src/sl3r/`** (last family dir) and the `core/loxodromic`/`sp6/hypergeometric`
  shims.
- **Phase 6 — Structural cleanup.** ◻ Resolve palette placement; collapse `embeddings.ts`
  wrappers into core chart constructors where possible; remove dead code; update `@/` notes,
  README, developer docs.
- **Phase 7 — Example format & seeding redesign (§12).** ◻ The one *type-changing,
  picture-affecting* pass, done across ALL families at once: featured = ref + caption,
  uniform auto-seeding via the loxodromic machinery, drop derived fields. Verified by
  before/after spot-checks, NOT bit-parity.

Rollback at any structural phase = the old family dir still exists until its parity gate
passes, so a failed phase reverts by not deleting.

---

## 10. Open decisions

1. **Palette home** (§2): beside each catalog (`examples/<cat>/palette.ts`) vs a shared
   `app/palettes.ts`. Default: beside catalog; revisit in Phase 6. ◻ open.
2. **`examples/projective/` grouping**: `triangle-groups/` + `rp3-pairs/` subdirs vs siblings.
   Cosmetic, decide in Phase 3. ◻ open.
3. **Curated/featured example format** — ✅ RESOLVED (see §12): featured = a `ref` to a
   catalog id (inline α/β only for true one-offs) + optional caption; `coefflists`,
   unicode `alpha/beta` display, and `expectedLambdaMax` are all dropped (derived /
   self-snapshot). Applied in Phase 7, not now.
4. **Seeding strategy** — ✅ RESOLVED (see §12): uniform auto-seed via the loxodromic
   machinery is the default for every real family; `seedWord?` survives only as a per-row
   override (sl2c until complex seeding lands; parabolic fallbacks). No stored `gamma` /
   family seed constant. Applied in Phase 7.
5. **Per-row generating sets**: walk menu on the recipe, default on the catalog; promote
   `walk` to a row only if a concrete case appears. ◻ deferred.
6. **Complex loxodromic seeding for kleinian** (§4.3): ✅ scheduled as part of Phase 7
   (needs `complexDominantCriterion` + a complex power-iteration step).

---

## 11. What is explicitly NOT changing

- `core/` algorithmic content (orbit walkers, chart fitters, cameras, spectral linalg) —
  only additions and one rename.
- `render/` and `app/` — untouched (pure visualization; they already depend only on the
  stable `core` interfaces `GroupAction`, `Orbit`, `SceneEmbedding`, `Palette`).
- The `GroupAction` interface itself — the entire engine is built around it and it is
  already the right abstraction.
- On-disk view-preset JSON shape, group tags, and example `id` strings (§5.3).
- `schwartz-pappus/box.ts` and `core/subdivision.ts` — the subdivision construction is a
  genuinely different (non-matrix-group) object and stays separate.

---

## 12. Phase 7 — Example format & seeding redesign (decided design)

The structural phases (1–5) deliberately keep each family's example *type* intact so they
stay pure, bit-identical moves. This phase — run ONCE across all families after the
structural migration lands — is the single type-changing, picture-affecting pass. It is
verified by **before/after visual spot-checks, not bit-parity** (the basepoint changes on
purpose).

### Why (the field audit)

A curated example today stores almost nothing irreducible. For the symplectic curated set
we verified:
- `coefflistf/g` = `cyclotomicProduct(α, β)` — derived.
- `alpha/beta` (unicode) = a display-only duplicate of the catalog's parseable α/β.
- `expectedLambdaMax` = `|λ_max(γ=TBT)|`, equal to the digit to what the code computes —
  a self-snapshot with **no independent source** (confirmed: not in the BDN paper). The
  bit-exact parity gates already guard regressions far better.
- `gamma`/`gammaName`/`powerIter` = `TBT`/`30` for ALL 88 — a family fact, not per-row.
- Only the catalog **id** (+ an optional human caption) is irreducible.

### Target shapes

**Featured/curated list** = hand-picked refs + presentation, nothing re-stored:
```ts
export const FEATURED = [
  'A-1', 'A-17', 'C-2',
  { ref: 'C-32', caption: 'open case · hull-overlay demo' },
  'C-47', 'C-55',
];
```
Resolve `ref` → catalog row → action via the family recipe. Inline `{ alpha, beta }` is the
escape hatch for a one-off not in any catalog. Same `FEATURED` pattern for every family
(sl2c's 7, sl4r's pairs, sl3r's set).

**Seeding** = an ability applied to the action, not stored data. Default: auto-search a
certified loxodromic word (`seedFromLoxodromic`) and power-iterate to its fixed point —
*more* rigorous than the trusted hand words. Strategy with override:
```ts
function seedFor(action, example, family) {
  if (example.seedWord) return computeProximalBasepoint(action, example.seedWord, iters); // override
  return seedFromLoxodromic(action, { fallbackWord: family.fallbackWord, ... });           // default
}
```
- `seedWord?` survives only as a per-row override: **sl2c** (until complex seeding is wired
  — also in this phase), and any group wanting a specific point.
- `fallbackWord` is the only family-level seed knob (e.g. o5's parabolic `TB` for the
  near-MUM cases; finite groups seed to nothing and draw nothing).

### Consequence

Drop from every example type: `coefflistf/g`, unicode `alpha/beta`, `expectedLambdaMax`,
per-row `gamma`/`gammaName`/`powerIter`. The basepoint shifts for the formerly hand-seeded
families (symplectic, triangle, sl4r) — **same limit set, different finite-depth sampling**
— so this is gated on a visual spot-check per family, with the old word available as a
`seedWord` override if an exact historical framing must be reproduced.
```
