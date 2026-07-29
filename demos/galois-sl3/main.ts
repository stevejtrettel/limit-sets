/**
 * SL(3,ℤ[√d]) via its Galois embedding — limit-set viewer in RP⁵.
 *
 * A group ⟨A(t), B(t)⟩ ⊂ SL(3, 𝒪_K) is sent into SL(3,ℝ)×SL(3,ℝ) ⊂ SL(6,ℝ) by
 * γ ↦ diag(γ, γ^σ), the two real places of K = ℚ(√d). Pipeline:
 *   1. pick a quadratic unit t from the catalog
 *   2. build the 6×6 block-sum action
 *   3. seed at the JOIN of the two factors' attracting fixed points for one word
 *      proximal in both (the 'seed' dropdown also offers the degenerate
 *      single-factor basepoints, which stay trapped in a plane — see recipe.ts)
 *   4. walk the non-backtracking word tree, embed R⁶ → R³ via a projective chart
 *   5. instanced spheres + autofit camera
 *
 * Everything except the catalog, recipe and palette is the shared generic
 * pipeline — the chart fitters, orbit walker and mesh builder are the same ones
 * sl4r (RP³) and sl7 (RP⁶) use; only the inferred dimension differs.
 *
 * "copy view JSON" posts to /__save-view/galois-sl3 →
 * outputs/presets/galois-sl3-view-preset.json for the offline render.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { ControlPanel } from '@/app/ControlPanel';
import { createSphereMaterial } from '@/app/instancedSpheres';
import { buildLimitSetMesh } from '@/app/limitSetMesh';
import { cameraSpecFromApp, viewportFromApp, saveViewPreset } from '@/app/viewExport';

import { InfoPanel } from '@/app/InfoPanel';

import { EXAMPLES, exampleById, type GaloisExample } from '@/examples/galois-sl3/catalog';
import {
  galoisAction, seedFactor, seedGalois, SEED_MODE_LABELS, type SeedMode,
} from '@/examples/galois-sl3/recipe';
import { describeExample } from '@/examples/galois-sl3/describe';
import { validateAllExamples } from '@/examples/galois-sl3/validate';
import { paletteForScheme } from '@/examples/galois-sl3/palette';
import type { ViewPreset } from '@/examples/galois-sl3/viewPreset';

import type { GroupAction } from '@/core/group';
import type { BlockSeed, Seed } from '@/core/seed';
import { generateOrbit, type Orbit } from '@/core/orbit';
import {
  type ChartEmbedding, fitPCAChartEmbedding, fitAutoChartEmbedding,
} from '@/core/chart';
import { schemeForColorDepth } from '@/render/colorScheme.ts';

validateAllExamples(EXAMPLES);

const app = new App({ antialias: true });
app.scene.background = new THREE.Color(0xffffff);

const { material, uniforms } = createSphereMaterial();

const DEFAULT_EXAMPLE_ID = 'phi';
const DEFAULT_DEPTH      = 11;  // 4 free codes → 4·3¹⁰ ≈ 236k leaves, live-OK
const DEFAULT_RADIUS     = 0.01;
const DEFAULT_CHART      = 'auto';
const DEFAULT_SEED_MODE: SeedMode = 'join';

// ─── State ──────────────────────────────────────────────────────────────────

let currentExample!:   GaloisExample;
let currentAction!:    GroupAction;
/** The active seed; a BlockSeed exactly when seedMode === 'join'. */
let currentSeed!:      Seed;
let currentOrbit!:     Orbit;
let currentProj!:      ChartEmbedding;
let currentMesh: THREE.Mesh | null = null;
let depth = DEFAULT_DEPTH;
let colorDepth = 0;
let seedMode: SeedMode = DEFAULT_SEED_MODE;
let stats = { kept: 0, totalWords: 0, balance: 0 };
let currentSeedNote = '';

function loadExample(id: string): void {
  currentExample = exampleById(id);
  currentAction = galoisAction(currentExample.unit);
  applySeed();
}

/** Rebuild just the basepoint (example unchanged, seed mode switched). */
function applySeed(): void {
  const u = currentExample.unit;
  if (seedMode === 'join') {
    const j: BlockSeed = seedGalois(u);
    currentSeed = j;
    currentSeedNote =
      `|λ| = [${j.blockLambdaMax.map((l) => l.toFixed(3)).join(', ')}], gap = ${j.minGap.toFixed(4)}`;
  } else {
    currentSeed = seedFactor(u, seedMode === 'factor1' ? 0 : 1);
    currentSeedNote = `|λ| = ${currentSeed.lambdaMax.toFixed(3)} (single factor)`;
  }
  console.log(
    `[galois-sl3-${currentExample.id}] seed(${seedMode}): γ = ${currentSeed.name}, ` +
    `${currentSeedNote}, drift = ${currentSeed.drift.toExponential(2)}`,
  );
}

function regenerateOrbit(N: number): void {
  const t0 = performance.now();
  currentOrbit = generateOrbit(currentAction, currentSeed.basepoint, N);
  const t1 = performance.now();
  console.log(
    `[galois-sl3-${currentExample.id}] BFS depth=${N}  words=${currentOrbit.count}  (${(t1 - t0).toFixed(0)}ms)`,
  );
}

/**
 * Fraction of orbit points whose first Galois block dominates,
 * ‖v₁‖ > ‖v₂‖. Near 0 or 1 means the picture has collapsed toward one factor's
 * plane; a middling value means the orbit genuinely explores RP⁵.
 */
function blockBalance(orbit: Orbit): number {
  const { vecs, count } = orbit;
  let dom = 0;
  for (let i = 0; i < count; i++) {
    const o = i * 6;
    const n1 = vecs[o] * vecs[o] + vecs[o + 1] * vecs[o + 1] + vecs[o + 2] * vecs[o + 2];
    const n2 = vecs[o + 3] * vecs[o + 3] + vecs[o + 4] * vecs[o + 4] + vecs[o + 5] * vecs[o + 5];
    if (n1 > n2) dom++;
  }
  return count > 0 ? dom / count : 0;
}

function rebuildMesh(autofit: boolean): void {
  const { mesh, kept } = buildLimitSetMesh({
    app, material, embedding: currentProj, orbit: currentOrbit,
    colorDepth, paletteForScheme, previous: currentMesh, autofit,
  });
  currentMesh = mesh;
  stats = { kept, totalWords: currentOrbit.count, balance: blockBalance(currentOrbit) };
}

/** 'auto' → overall projective PCA; '0'..'5' → v_k axis chart with PCA axes. */
function applyChartSelection(value: string): void {
  currentProj = value === 'auto'
    ? fitAutoChartEmbedding(currentOrbit)
    : fitPCAChartEmbedding(currentOrbit, parseInt(value, 10));
}

// ─── Initial load ───────────────────────────────────────────────────────────

loadExample(DEFAULT_EXAMPLE_ID);
regenerateOrbit(depth);
applyChartSelection(DEFAULT_CHART);
rebuildMesh(true);

// ─── HUD ────────────────────────────────────────────────────────────────────

const panel = new ControlPanel({ title: 'SL(3,ℤ[√d]) ↪ SL(3)×SL(3) — limit sets in RP⁵' });
const info = new InfoPanel({ title: 'the construction' });

panel.select({
  label: 'example',
  options: EXAMPLES.map((e) => ({ value: e.id, label: e.label })),
  value: DEFAULT_EXAMPLE_ID,
  onChange: (id) => {
    loadExample(id);
    slDepth.set(DEFAULT_DEPTH);
    depth = DEFAULT_DEPTH;
    regenerateOrbit(depth);
    applyChartSelection(selChart.value);
    rebuildMesh(true);
    updateUI();
  },
});
const exMeta = panel.text({ variant: 'meta' });

panel.separator();

const selSeed = panel.select({
  label: 'seed',
  options: (Object.keys(SEED_MODE_LABELS) as SeedMode[])
    .map((m) => ({ value: m, label: SEED_MODE_LABELS[m] })),
  value: DEFAULT_SEED_MODE,
  onChange: (v) => {
    seedMode = v as SeedMode;
    applySeed();
    regenerateOrbit(depth);
    applyChartSelection(selChart.value);
    rebuildMesh(true);
    updateUI();
  },
});

const slDepth = panel.slider({
  label: 'depth N',
  min: 4, max: 14, step: 1, value: depth,
  onChange: (v) => {
    depth = v;
    regenerateOrbit(v);
    rebuildMesh(false);
    updateUI();
  },
});

panel.slider({
  label: 'ball radius',
  min: 0.001, max: 0.06, step: 0.0005, value: DEFAULT_RADIUS,
  format: (v) => v.toFixed(3),
  event: 'input',
  onChange: (v) => { uniforms.uRadius.value = v; },
});

const DEFAULT_FOV = app.camera.fov;
const slFov = panel.slider({
  label: 'fov',
  min: 0.5, max: 90, step: 0.5, value: DEFAULT_FOV,
  format: (v) => `${v}°`,
  event: 'input',
  onChange: (v) => {
    app.camera.fov = v;
    app.camera.updateProjectionMatrix();
  },
});

panel.separator();

const selChart = panel.select({
  label: 'chart',
  options: [
    { value: 'auto', label: 'auto-chart (projective PCA)' },
    { value: '0', label: 'v₁ chart (PCA axes)' },
    { value: '1', label: 'v₂ chart (PCA axes)' },
    { value: '2', label: 'v₃ chart (PCA axes)' },
    { value: '3', label: 'v₄ chart (PCA axes)' },
    { value: '4', label: 'v₅ chart (PCA axes)' },
    { value: '5', label: 'v₆ chart (PCA axes)' },
  ],
  value: DEFAULT_CHART,
  onChange: (v) => {
    applyChartSelection(v);
    rebuildMesh(true);
    updateUI();
  },
});

panel.select({
  label: 'color by',
  options: [
    { value: '0', label: 'grayscale' },
    { value: '1', label: 'last letter (g_n)' },
    { value: '2', label: '2nd-to-last letter (g_{n−1})' },
    { value: '3', label: '3rd-to-last letter (g_{n−2})' },
    { value: '4', label: '4th-to-last letter (g_{n−3})' },
    { value: '5', label: '5th-to-last letter (g_{n−4})' },
  ],
  value: '0',
  onChange: (v) => {
    colorDepth = parseInt(v, 10);
    rebuildMesh(false);
    updateUI();
  },
});

panel.button({
  label: 'reset',
  onClick: () => {
    depth = DEFAULT_DEPTH;
    seedMode = DEFAULT_SEED_MODE;
    slDepth.set(DEFAULT_DEPTH);
    selSeed.set(DEFAULT_SEED_MODE);
    selChart.set(DEFAULT_CHART);
    slFov.set(DEFAULT_FOV);
    app.camera.fov = DEFAULT_FOV;
    app.camera.updateProjectionMatrix();
    applySeed();
    regenerateOrbit(depth);
    applyChartSelection(DEFAULT_CHART);
    rebuildMesh(true);
    updateUI();
  },
});

panel.button({
  label: 'info window (generators + basepoint)',
  onClick: () => info.toggle(),
});

const modeEl  = panel.text({ variant: 'mode' });
const statsEl = panel.text({ variant: 'stats' });

panel.button({
  label: 'screenshot',
  onClick: () => {
    app.screenshot(
      `galois-sl3-${currentExample.id}_${seedMode}_${currentProj.label}_${stats.kept}pts_${shotTimestamp()}.png`,
    );
  },
});

panel.separator();

panel.button({
  label: 'copy view JSON for offline render',
  onClick: exportView,
});
const exportStatus = panel.text({ variant: 'meta' });

function shotTimestamp(): string {
  return new Date().toISOString().replace(/[-:]|\..*/g, '').replace('T', '-');
}

function updateUI(): void {
  statsEl.text(
    `${stats.totalWords.toLocaleString()} words, ` +
    `${stats.kept.toLocaleString()} drawn, ` +
    `${(100 * stats.balance).toFixed(1)}% ρ-dominant`,
  );
  modeEl.text(`view: ${currentProj.pretty}`);
  exMeta.html(
    `${currentExample.description}<br>` +
    `γ = ${currentSeed.name} — ${currentSeedNote}`,
  );
  info.sections(describeExample(currentExample, seedMode, currentSeed));
}

// ─── Export view for offline render ─────────────────────────────────────────

async function exportView(): Promise<void> {
  const bundle: ViewPreset = {
    exampleId:    currentExample.id,
    previewDepth: depth,
    colorScheme:  schemeForColorDepth(colorDepth).name,
    seedMode,
    projection: {
      denom: Array.from(currentProj.denom),
      rowX:  Array.from(currentProj.rows[0]),
      rowY:  Array.from(currentProj.rows[1]),
      rowZ:  Array.from(currentProj.rows[2]),
      label: currentProj.label,
    },
    camera:   cameraSpecFromApp(app),
    viewport: viewportFromApp(app),
  };
  await saveViewPreset('galois-sl3', bundle, (msg, ok) =>
    exportStatus.flash(msg, 2500, ok ? '#9ec79e' : '#d9a55c'));
}

updateUI();

app.start();
