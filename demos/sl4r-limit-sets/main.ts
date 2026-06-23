/**
 * SL(4,R) / GL(4,R) — limit-set viewer in RP³.
 *
 * Pipeline:
 *   1. pick an example (a pair of 4×4 matrices ⟨A, B⟩)
 *   2. find ξ₊(γ) ∈ Λ via power-iteration of a loxodromic γ word
 *   3. walk the non-backtracking word tree from ξ₊
 *   4. embed each R⁴ state to R³ via a chart (auto-PCA by default, or one of
 *      the four axis charts v_k = 1 with PCA-fit axes)
 *   5. instanced spheres + autofit camera
 *
 * The chart code is shared with sp6 — auto-chart = projective PCA, axis
 * charts = v_k denom + PCA axes inside that affine chart.
 *
 * The "copy view JSON" button posts to /__save-view/sl4r → scripts/sl4r-view-preset.json
 * for the offline render.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { ControlPanel } from '@/app/ControlPanel';
import { createSphereMaterial } from '@/app/instancedSpheres';
import { buildLimitSetMesh } from '@/app/limitSetMesh';
import { cameraSpecFromApp, viewportFromApp, saveViewPreset } from '@/app/viewExport';

import type { SL4RExample } from '@/sl4r/types';
import { EXAMPLES, exampleById } from './pair1';
import { makeMat4Action } from '@/sl4r/action';
import type { GroupAction } from '@/core/group';
import {
  computeProximalBasepoint, generateOrbit, type Orbit,
} from '@/core/orbit';
import {
  type ChartEmbedding,
  fitPCAChartEmbedding, fitAutoChartEmbedding, makeChartFromData,
} from '@/core/chart';
import { validateAllExamples } from '@/sl4r/validate';
import { schemeForColorDepth } from '@/render/colorScheme.ts';
import { paletteForScheme } from '@/sl4r/palettes.ts';
import type { ViewPreset } from '@/sl4r/viewPreset.ts';

validateAllExamples(EXAMPLES);

const app = new App({ antialias: true });
app.scene.background = new THREE.Color(0xffffff);

const { material, uniforms } = createSphereMaterial();

const DEFAULT_EXAMPLE_ID = 'pair1';
const DEFAULT_DEPTH       = 11; // 4 gens, free → ~3·3^10 ≈ 177k nodes, live-OK
const DEFAULT_RADIUS      = 0.01;
/**
 * Chart selector value. If the default example carries any custom charts
 * (see `SL4RExample.customCharts`), the first one is preferred and its id
 * becomes the default. Otherwise we fall back to the projective-PCA auto-chart.
 */
const DEFAULT_CHART = exampleById(DEFAULT_EXAMPLE_ID).customCharts?.[0]?.id ?? 'auto';

// ─── State ──────────────────────────────────────────────────────────────────

let currentExample!:   SL4RExample;
let currentAction!:    GroupAction;
let currentBasepoint!: Float64Array;
let currentOrbit!:     Orbit;
let currentProj!:      ChartEmbedding;
let currentMesh: THREE.Mesh | null = null;
let depth = DEFAULT_DEPTH;
let colorDepth = 0;
let stats = { kept: 0, totalWords: 0 };

function loadExample(id: string): void {
  currentExample = exampleById(id);
  currentAction = makeMat4Action(currentExample.generators, {
    involutions: currentExample.involutions,
  });
  const r = computeProximalBasepoint(
    currentAction, currentExample.gamma, currentExample.powerIter);
  currentBasepoint = r.basepoint;
  console.log(
    `[sl4r-${currentExample.id}] loaded: |λ_max(${currentExample.gammaName})| ≈ ${r.lambdaMax.toFixed(3)}, ` +
    `drift = ${r.drift.toFixed(4)}`,
  );
}

function regenerateOrbit(N: number): void {
  const t0 = performance.now();
  currentOrbit = generateOrbit(currentAction, currentBasepoint, N);
  const t1 = performance.now();
  console.log(
    `[sl4r-${currentExample.id}] BFS depth=${N}  words=${currentOrbit.count}  (${(t1 - t0).toFixed(0)}ms)`,
  );
}

function rebuildMesh(autofit: boolean): void {
  const { mesh, kept } = buildLimitSetMesh({
    app, material, embedding: currentProj, orbit: currentOrbit,
    colorDepth, paletteForScheme, previous: currentMesh, autofit,
  });
  currentMesh = mesh;
  stats = { kept, totalWords: currentOrbit.count };
}

/**
 * Resolve the chart selector value to a ChartEmbedding. Order of resolution:
 *   1. example.customCharts (data-only, hand-picked — like Fabi's chart)
 *   2. 'auto' → overall projective PCA
 *   3. '0'..'3' → v_k axis chart with PCA axes
 */
function applyChartSelection(value: string): void {
  const custom = currentExample.customCharts?.find((c) => c.id === value);
  if (custom) {
    currentProj = makeChartFromData({
      stateDim: 4,
      denom: [...custom.denom],
      rows: [[...custom.rowX], [...custom.rowY], [...custom.rowZ]],
      label: custom.id,
      pretty: custom.pretty ?? custom.label,
    });
    return;
  }
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

const panel = new ControlPanel({ title: 'SL(4,R) — limit sets in RP³' });

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

// Custom charts (from currentExample.customCharts) lead the dropdown; the
// generic fitters follow. Built from the default example at startup — if
// you add multiple examples, each with different custom charts, you'll need
// to rebuild this <select> on example change.
const CHART_OPTIONS = [
  ...(currentExample.customCharts ?? []).map((c) => ({ value: c.id, label: c.label })),
  { value: 'auto', label: 'auto-chart (projective PCA)' },
  { value: '0',    label: 'v₁ chart (PCA axes)' },
  { value: '1',    label: 'v₂ chart (PCA axes)' },
  { value: '2',    label: 'v₃ chart (PCA axes)' },
  { value: '3',    label: 'v₄ chart (PCA axes)' },
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
      `sl4r-${currentExample.id}_${currentProj.label}_${stats.kept}pts_${shotTimestamp()}.png`,
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
    `γ = ${currentExample.gammaName}`,
  );
}

// ─── Export view for offline render ─────────────────────────────────────────

async function exportView(): Promise<void> {
  const bundle: ViewPreset = {
    exampleId:    currentExample.id,
    previewDepth: depth,
    colorScheme:  schemeForColorDepth(colorDepth).name,
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
  await saveViewPreset('sl4r', bundle, (msg, ok) =>
    exportStatus.flash(msg, 2500, ok ? '#9ec79e' : '#d9a55c'));
}

updateUI();

app.start();
