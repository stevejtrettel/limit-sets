# sp6-paper — the paper's figure set, and nothing else

```bash
npm run dev sp6-paper
```

A viewer holding exactly the nine panels of the paper's three-row comparison. It
is **not** a browser: no catalog is reachable from here, and the 458-group BDSS
atlas is not imported. Curation happens in `sp6-explorer`; when you decide on a
group you add one line to `FIGURES`.

## The three rows

|  | row | job |
| --- | --- | --- |
| 1 | known arithmetic | teach the reader what arithmetic looks like |
| 2 | known thin | teach the reader what thin looks like |
| 3 | resolved here | C-47, C-55 (arithmetic) and C-32 (thin) — classify by eye |

Rows 1 and 2 teach a *signature*, so their three members should be as unlike each
other as possible in parameters. If all three shared an α, a reader could
attribute the shared look to α rather than to the status, and the row would teach
nothing. `scripts/tests/sp6-paper-gates.ts` warns when a row's α are not distinct.

## Editing the figure list

Everything lives in [`paperFigures.ts`](../../src/examples/hypergeometric/paperFigures.ts).
A figure names a group by its Bajpai–Doña–Nitsche label:

```ts
{ id: 'arith-2', label: 'Fig 1b', row: 'arithmetic', from: 'A-25',
  caption: 'arithmetic · β from 4th roots' },
```

`from` resolves against the 88-group BDN catalog, so no (α, β) data is
duplicated. For a group **outside** that catalog — e.g. an arithmetic group with
α ≠ 0, which only exists in the wider BDSS atlas — give the tuples directly and
copy the two lines across by hand:

```ts
{ id: 'arith-2', label: 'Fig 1b', row: 'arithmetic',
  alpha: ['0','0','0','0','1/6','5/6'],
  beta:  ['1/3','2/3','1/12','5/12','7/12','11/12'],
  caption: 'arithmetic · BDSS Table B #35' },
```

That is the intended way to pull one group in from the wider atlas without this
demo depending on it.

`id` keys the saved framing, so renaming one orphans its camera.

## The pinned seed

Every figure is seeded from **γ = TBT** (T = A⁻¹B), the word §5 of the paper
names — *not* the per-group auto-search the browsing demos use. Pinning it is
what makes the figures reproducible from the text alone.

The panel shows the true spectral gap **|λ₁/λ₂|** (not |λ_max|, which is a
different number — that is what BDN tabulate) and turns amber below the ≥ 10 that
§5 claims. Run the gate after any edit:

```bash
node scripts/tests/sp6-paper-gates.ts
```

It fails if TBT is not loxodromic for some figure, or if any gap drops below 10 —
the check that stops a figure swap from quietly falsifying the text.

## Per-figure framing

Nine panels each want their own camera, so the demo remembers one per figure:

- **save framing (this figure)** — stores the current chart, depth and camera;
- **write all framings to disk** — persists the whole set to
  `outputs/presets/sp6-paper-view-preset.json`, re-read at startup;
- **clear this figure's framing** — back to autofit.

Switching figures restores that figure's framing if it has one, and autofits
otherwise. The saved bundle is `{ figures: { <id>: ViewPreset } }` — one file for
all nine rather than nine files.

Note `outputs/` is gitignored, so a framing set is **not** reproducible from a
clone. If the paper's figures should be rebuildable from the repo alone, that
file needs to move somewhere tracked.

## Offline renderer

`scripts/render/sp6-paper.ts`, a thin plugin over the shared
render driver.

```sh
node scripts/render/sp6-paper.ts c32 15
node scripts/render/sp6-paper.ts thin-1 15 --tone 0.5 --gamma 0.8
```

Arguments are FIGURE ids (`arith-1`…`arith-3`, `thin-1`…`thin-3`, `c47`, `c55`,
`c32`), not catalog labels. Every figure is seeded from the pinned γ = TBT, and
the banner prints that figure's spectral gap, flagging anything under
`PAPER_MIN_GAP`.

Framing comes from "save framing for render" in the demo, which the script reads
by default; `--no-preset` forces the PCA autofit. One caveat: a preset holds
exactly **one** figure, so producing the whole nine-panel set means re-framing
each one, or rendering the rest with `--no-preset`.

Depth is expensive here — the free walk on {A, A⁻¹, B, B⁻¹} is a 3^N tree, so
depth 15 is ≈28.7M words. The driver streams the orbit, so that is time, not RAM.

The appendix figure set (the eight open degree-5 orthogonal cases) lives in the
separate `sp6-paper-appendix` demo, with its own renderer.

## Background is white

Per the house rule: figures render on white, and dim limit sets get fixed with
gamma/tone, not a dark background.
