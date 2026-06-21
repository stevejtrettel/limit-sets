# Sp(6) hypergeometric explorer

Browse the Bajpai–Doña–Nitsche catalog of degree-six "companion matrix"
hypergeometric monodromy groups, filtered by **thin / arithmetic** family, and
draw each one's limit set in ℝℙ⁵.

```bash
npm run dev sp6-explorer
```

## What's in the catalog

Source: J. Bajpai, D. Doña, M. Nitsche, *Thin monodromy in Sp(4) and Sp(6)*
(arXiv:2112.12111), **Tables 1–2** (`Sep22.tex` / `thin-monodromy.pdf` at the
repo root). Each group is a pair of hypergeometric parameter tuples (α, β) of
rotation numbers; its two generators are the companion matrices of
f(x) = ∏(x − e^{2πiαⱼ}) and g(x) = ∏(x − e^{2πiβⱼ}).

| Table | Groups | Nature |
| --- | --- | --- |
| **1** — maximally unipotent (α = 0) | A-1 … A-40 | 17 thin, 23 arithmetic |
| **2** — more thin by ping-pong (α ≠ 0) | C-2 … C-58 (gaps) | all thin |
| **3** — open cases (α ≠ 0) | C-32, C-47, C-55 | unclassified |

**88 groups total** (40 + 45 + 3). The polynomials are *derived* from (α, β) at
load time by [`hypergeometric.ts`](../../src/sp6/hypergeometric.ts) — the data
lives in [`catalog.ts`](../../src/sp6/catalog.ts) as `(label, α, β, nature)`
rows, not hand-typed coefficient lists.

### Excluded on purpose
- **Table 4** (degree-4 Sp(4)) — it needs a degree-4 companion action, not the
  degree-6 `makeSp6Action` this catalog targets.
- **C-15** — the paper prints β = (1/2,1/2,1/6,5/6,5/6,5/6), which is *not*
  conjugate-closed (1/6 once, 5/6 thrice) and so defines no real polynomial. It
  is a typo (confirmed in `Sep22.tex`); the position-implied intended value is
  A-11's β. Omitted pending confirmation — see `C15_TYPO` in `catalog.ts`.

This catalog is **independent** of [`examples.ts`](../../src/sp6/examples.ts)
(used by the `sp6-limit-sets` and `c32` demos). Note: that legacy list's old
"A-15" row actually carried A-17's β and has been relabeled A-17.

## UI

The panel has two folders plus a status/actions block.

**Group** (open) — *which* group you're looking at:
- **family** — `all` / `thin` / `arithmetic` / `open`. Repopulates the group dropdown.
- **group** — every catalog group in the chosen family, grouped into
  `<optgroup>`s by source table (Table 1 A-rows, Table 2 C-rows, Table 3 open).
  In `all` mode each label is annotated with its nature.
- metadata readout: label, nature, α, β, γ, |λ_max(γ)|.

**View** — how the fixed orbit is projected, colored, and framed:
- **chart** — `vₖ chart (PCA axes)` for k = 1…6, or `auto-chart (overall PCA)`.
- **color by** — grayscale, or by the k-th-to-last generator letter.
- **depth N** — BFS depth; re-runs the orbit, **preserves camera + chart**.
- **ball radius**, **fov** — display knobs.
- **reset view** — depth, chart, fov back to defaults (does *not* change the group).

**Top level** — a status line (word / point counts) and **screenshot**
(`sp6-<label>_<chart>_<kept>pts_<timestamp>.png`).

Each group is validated lazily on selection (structural + γ=TBT power iteration);
warnings print to the console.

## Render path

Identical to `sp6-limit-sets`: proximal-basepoint power iteration on γ = TBT →
non-backtracking BFS orbit → projective chart π(v) = (R·v)/(d·v) → instanced
spheres, with percentile-bbox autofit. All of it is the dimension-agnostic core
in [`src/core`](../../src/core) and [`src/render`](../../src/render).

## Adding / correcting a group

Edit the `TABLE1` / `TABLE2` arrays in
[`catalog.ts`](../../src/sp6/catalog.ts) — append a `(label, table, nature, α, β)`
row. `rowToExample` derives f, g and throws if (α, β) is not conjugate-closed, so
a mistyped tuple fails loudly rather than drawing garbage.
