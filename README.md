# Sp(6,Z) limit sets

Interactive browser viewer and offline high-resolution renderer for the
limit sets of the six Brav–Datta–Naqvi examples of `Sp(6,Z)` Anosov
subgroups in `RP^5`.

## Demos

- **`o5-explorer`** — degree-5 *orthogonal* hypergeometric atlas. Browse the
  **full classification** — all 77 groups of Bajpai–Singh ([arXiv:1706.08791])
  numbered 1–77: 28 thin + 37 arithmetic + 8 open + 4 finite. Filter by status:
  *thin* groups give fractal limit sets, *arithmetic* groups are lattices (dense
  orbit closure), *finite* groups have no limit set. The group is the free
  product ⟨T⟩ ∗ ⟨B⟩ (T = BA⁻¹ a reflection); the orbit walks the {T, B} alphabet
  and is seeded by the attracting point of an auto-found loxodromic word
  (`src/o5/seed.ts` → `src/core/loxodromic.ts`). The "save framing for render"
  button exports the framed view for the render script. The 28 thin + 8 open are
  the Bajpai–Nitsche *Thin Monodromy in O(5)* headliners; the rest were settled
  by Venkataramana / Singh / Fuchs–Meiri–Sarnak.

[arXiv:1706.08791]: https://arxiv.org/abs/1706.08791
- **`sp6-explorer`** — catalog explorer. Browse all 85 Bajpai–Doña–Nitsche
  Sp(6) hypergeometric groups (Tables 1–2) filtered by thin / arithmetic family.
  See [`demos/sp6-explorer/README.md`](demos/sp6-explorer/README.md).
- **`sp6-limit-sets`** — viewer. Pick an example, depth N, chart, and color
  scheme; orbit (un-)autofits in the canvas.
- **`sp6-limit-sets-render`** — same viewer plus a "copy view JSON for offline
  render" button. Frames the shot in the browser, then the offline script
  renders the *same* view at much higher BFS depth and resolution.

## Run

```sh
npm install
npm run dev o5-explorer                 # O(5) catalog explorer
npm run dev sp6-limit-sets              # or sp6-limit-sets-render
npm run build sp6-limit-sets-render
npm run preview sp6-limit-sets-render
```

Offline O(5) render, two modes:
- **auto** — `node scripts/o5-render-limit-set.ts <id> [depth]` (ids are `g1`…
  `g77`, e.g. `g5`, `g48`): PCA autofit, orthographic.
- **view preset** — in `o5-explorer`, frame a shot and click "save framing for
  render" (the dev server writes `scripts/o5-view-preset.json`), then
  `node scripts/o5-render-limit-set.ts --depth 18`: reproduces that exact
  perspective view at higher depth. Pass `--no-preset` to force auto mode.

`node scripts/o5-validate-catalog.ts` checks all 77 groups parse and seed cleanly.

The dev/build/preview commands take the demo name as their argument; the
runner script rewrites the `<script>` tag in `index.html` accordingly.

## Offline render

```sh
# 1. open the -render demo, frame your shot, click "copy view JSON for offline render"
#    (the dev-server middleware writes scripts/sp6-view-preset.json)
# 2. render
node scripts/sp6-render-limit-set.mjs            # uses DEFAULT_DEPTH from the script
node scripts/sp6-render-limit-set.mjs 14         # override depth
```

Render scripts write 8-bit PNGs to `outputs/<family>/` (e.g. `outputs/o5/`,
`outputs/sp6/`), foldered by family and gitignored. Memory floor is roughly
48 bytes per BFS node: depth 13 ≈ 150 MB, depth 14 ≈ 460 MB, depth 15 ≈ 1.4 GB.
For depth ≥ 14 run with `node --max-old-space-size=8192 scripts/sp6-render-limit-set.mjs`.

Edit the `EDITABLE` block at the top of `scripts/sp6-render-limit-set.mjs`
for image size, tone curve, splat radius, etc.

## Layout

```
src/app/App.ts              minimal three.js boilerplate (scene + camera + OrbitControls + screenshot)
demos/<demo>/main.ts        per-demo entry; builds its own HUD inline
scripts/run-demo.mjs        rewrites index.html's script tag, then runs vite
scripts/sp6-render-limit-set.mjs   pure-node offline renderer (no GPU)
```
