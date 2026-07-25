/**
 * SL(7,ℝ) — limit-set viewer in RP⁶ for three-involution (Goldman–Parker
 * variant) groups.
 *
 * Pipeline (identical to sl4r, one dimension up):
 *   1. pick an example (a triple of 7×7 involutions ⟨g₁, g₂, g₃⟩)
 *   2. find ξ₊(γ) ∈ Λ via power-iteration of a real-dominant loxodromic γ word
 *   3. walk the non-backtracking word tree (reduced words in ℤ/2 ∗ ℤ/2 ∗ ℤ/2)
 *   4. embed each R⁷ state to R³ via a chart (auto-PCA by default, or one of
 *      the seven axis charts v_k = 1 with PCA-fit axes)
 *   5. instanced spheres + autofit camera
 *
 * NOTE: for the goldman-parker-7 example the orbit lies in a rank-3 invariant
 * subspace of R⁷ — the limit set is planar (RP² ⊂ RP⁶), so the auto-chart's
 * third axis carries ≈ 0 signal and a top-down view reads best.
 *
 * The "copy view JSON" button posts to /__save-view/sl7 →
 * outputs/presets/sl7-view-preset.json for the offline render.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { ControlPanel } from '@/app/ControlPanel';
import { createSphereMaterial } from '@/app/instancedSpheres';
import { buildLimitSetMesh } from '@/app/limitSetMesh';
import { cameraSpecFromApp, viewportFromApp, saveViewPreset } from '@/app/viewExport';

import {
  EXAMPLES, exampleById, seedRP6, type RP6Example,
} from '@/examples/projective/rp6-triples/data';
import { validateAllExamples } from '@/examples/projective/rp6-triples/validate';
import { paletteForScheme } from '@/examples/projective/rp6-triples/palette';
import type { ViewPreset } from '@/examples/projective/rp6-triples/viewPreset';
import { makeMatrixAction, asInvolutions } from '@/core/matrixAction';
import type { GroupAction } from '@/core/group';
import { generateOrbit, type Orbit } from '@/core/orbit';
import {
  type ChartEmbedding,
  fitPCAChartEmbedding, fitAutoChartEmbedding,
} from '@/core/chart';
import { schemeForColorDepth } from '@/render/colorScheme.ts';

validateAllExamples(EXAMPLES);

const app = new App({ antialias: true });
app.scene.background = new THREE.Color(0xffffff);

const { material, uniforms } = createSphereMaterial();

const DEFAULT_EXAMPLE_ID = 'goldman-parker-7';
const DEFAULT_DEPTH       = 14; // 3 involutions → ~3·2^13 ≈ 49k nodes, live-OK
const DEFAULT_RADIUS      = 0.01;
const DEFAULT_CHART = 'auto';
/** basepoint + 3 involution colors — K for the last-gen / kth-last schemes. */
const CATEGORY_COUNT = 4;

// ─── State ──────────────────────────────────────────────────────────────────

let currentExample!:   RP6Example;
let currentAction!:    GroupAction;
let currentBasepoint!: Float64Array;
let currentOrbit!:     Orbit;
let currentProj!:      ChartEmbedding;
let currentMesh: THREE.Mesh | null = null;
let depth = DEFAULT_DEPTH;
let colorDepth = 0;
let stats = { kept: 0, totalWords: 0 };
let currentSeedName = '';

function loadExample(id: string): void {
  currentExample = exampleById(id);
  currentAction = makeMatrixAction(asInvolutions(currentExample.generators));
  const s = seedRP6(currentAction);
  currentBasepoint = s.basepoint;
  currentSeedName = s.name;
  console.log(
    `[sl7-${currentExample.id}] loaded: γ = ${s.name}, |λ_max| ≈ ${s.lambdaMax.toFixed(3)}, ` +
    `drift = ${s.drift.toFixed(4)}`,
  );
}

function regenerateOrbit(N: number): void {
  const t0 = performance.now();
  currentOrbit = generateOrbit(currentAction, currentBasepoint, N);
  const t1 = performance.now();
  console.log(
    `[sl7-${currentExample.id}] BFS depth=${N}  words=${currentOrbit.count}  (${(t1 - t0).toFixed(0)}ms)`,
  );
}

function rebuildMesh(autofit: boolean): void {
  const { mesh, kept } = buildLimitSetMesh({
    app, material, embedding: currentProj, orbit: currentOrbit,
    colorDepth, categoryCount: CATEGORY_COUNT, paletteForScheme,
    previous: currentMesh, autofit,
  });
  currentMesh = mesh;
  stats = { kept, totalWords: currentOrbit.count };
}

/** Resolve the chart selector value: 'auto' → overall projective PCA;
 *  '0'..'6' → v_k axis chart with PCA-fit axes. */
function applyChartSelection(value: string): void {
  if (value === 'auto') {
    currentProj = fitAutoChartEmbedding(currentOrbit);
  } else {
    currentProj = fitPCAChartEmbedding(currentOrbit, parseInt(value, 10));
  }
}

// ─── Initial load ───────────────────────────────────────────────────────────

loadExample(DEFAULT_EXAMPLE_ID);
regenerateOrbit(depth);
applyChartSelection(DEFAULT_CHART);
rebuildMesh(true);

// ─── HUD ────────────────────────────────────────────────────────────────────

const panel = new ControlPanel({ title: 'SL(7,ℝ) — limit sets in RP⁶' });

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

const slDepth = panel.slider({
  label: 'depth N',
  min: 4, max: 18, step: 1, value: depth,
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

const CHART_OPTIONS = [
  { value: 'auto', label: 'auto-chart (projective PCA)' },
  { value: '0',    label: 'v₁ chart (PCA axes)' },
  { value: '1',    label: 'v₂ chart (PCA axes)' },
  { value: '2',    label: 'v₃ chart (PCA axes)' },
  { value: '3',    label: 'v₄ chart (PCA axes)' },
  { value: '4',    label: 'v₅ chart (PCA axes)' },
  { value: '5',    label: 'v₆ chart (PCA axes)' },
  { value: '6',    label: 'v₇ chart (PCA axes)' },
];

const selChart = panel.select({
  label: 'chart',
  options: CHART_OPTIONS,
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
    { value: '1', label: 'last letter (gₙ)' },
    { value: '2', label: '2nd-to-last letter (gₙ₋₁)' },
    { value: '3', label: '3rd-to-last letter (gₙ₋₂)' },
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
    slDepth.set(DEFAULT_DEPTH);
    selChart.set(DEFAULT_CHART);
    slFov.set(DEFAULT_FOV);
    app.camera.fov = DEFAULT_FOV;
    app.camera.updateProjectionMatrix();
    regenerateOrbit(depth);
    applyChartSelection(DEFAULT_CHART);
    rebuildMesh(true);
    updateUI();
  },
});

const modeEl  = panel.text({ variant: 'mode' });
const statsEl = panel.text({ variant: 'stats' });

panel.button({
  label: 'screenshot',
  onClick: () => {
    app.screenshot(
      `sl7-${currentExample.id}_${currentProj.label}_${stats.kept}pts_${shotTimestamp()}.png`,
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
    `${stats.kept.toLocaleString()} drawn`,
  );
  modeEl.text(`view: ${currentProj.pretty}`);
  exMeta.html(
    `${currentExample.description}<br>` +
    `γ = ${currentSeedName}`,
  );
}

// ─── Export view for offline render ─────────────────────────────────────────

async function exportView(): Promise<void> {
  const bundle: ViewPreset = {
    exampleId:    currentExample.id,
    previewDepth: depth,
    colorScheme:  schemeForColorDepth(colorDepth, CATEGORY_COUNT).name,
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
  await saveViewPreset('sl7', bundle, (msg, ok) =>
    exportStatus.flash(msg, 2500, ok ? '#9ec79e' : '#d9a55c'));
}

updateUI();

app.start();
