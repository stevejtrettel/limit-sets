/**
 * Sp(6,Z) — limit-set viewer with view-export for offline render.
 *
 * Cloned from sp6-limit-sets; adds an "Export view" button that serializes
 * the current camera + projection + example/depth as JSON. The dev server
 * writes it to scripts/sp6-view-preset.json; falls back to clipboard otherwise.
 * The offline render script (scripts/sp6-render-limit-set.mjs) consumes
 * that file to produce a high-resolution render matching the previewed view.
 *
 * Behaviors: same as sp6-limit-sets.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { ControlPanel } from '@/app/ControlPanel';
import { createSphereMaterial, makeInstancedSpheres } from '@/app/instancedSpheres';
import { autofitCamera } from '@/app/autofit';

import {
  EXAMPLES, exampleById, type ExampleGroup,
} from '@/sp6/examples';
import { makeSp6Action } from '@/sp6/action';
import type { GroupAction } from '@/core/group';
import {
  computeProximalBasepoint, generateOrbit, type Orbit,
} from '@/core/orbit';
import {
  type ChartEmbedding,
  fitPCAChartEmbedding, fitAutoChartEmbedding,
} from '@/core/chart';
import { validateAllExamples } from '@/sp6/validate';
import { schemeForColorDepth } from '@/render/colorScheme.ts';
import { buildOrbitInstances } from '@/render/orbitInstances.ts';
import { paletteForScheme } from '@/sp6/palettes.ts';
import type { ViewPreset } from '@/sp6/viewPreset.ts';

validateAllExamples(EXAMPLES);

const app = new App({ antialias: true });
app.scene.background = new THREE.Color(0xf2f2f2);

const { material, uniforms } = createSphereMaterial();

const DEFAULT_EXAMPLE_ID = 'A17';
const DEFAULT_DEPTH = 12;
const DEFAULT_RADIUS = 0.025;

// ─── State ──────────────────────────────────────────────────────────────────

let currentExample!:   ExampleGroup;
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
  currentAction = makeSp6Action(currentExample);
  const r = computeProximalBasepoint(currentAction, currentExample.gamma, currentExample.powerIter);
  currentBasepoint = r.basepoint;
  console.log(
    `[sp6-${currentExample.id}] loaded: |λ_max(${currentExample.gammaName})| ≈ ${r.lambdaMax.toFixed(3)}` +
    `, drift = ${r.drift.toFixed(4)}`,
  );
}

function regenerateOrbit(N: number): void {
  const t0 = performance.now();
  currentOrbit = generateOrbit(currentAction, currentBasepoint, N);
  const t1 = performance.now();
  console.log(
    `[sp6-${currentExample.id}] BFS depth=${N}  words=${currentOrbit.count}  (${(t1 - t0).toFixed(0)}ms)`,
  );
}

function rebuildMesh(autofit: boolean): void {
  const scheme = schemeForColorDepth(colorDepth);
  const palette = paletteForScheme(scheme.name);
  const { aPos, aColor, kept } = buildOrbitInstances(currentProj, currentOrbit, scheme, palette);

  const mesh = makeInstancedSpheres(material, aPos, aColor);
  if (currentMesh) {
    app.scene.remove(currentMesh);
    currentMesh.geometry.dispose();
  }
  app.scene.add(mesh);
  currentMesh = mesh;

  if (autofit) autofitCamera(app, aPos, kept);

  stats = { kept, totalWords: currentOrbit.count };
}

/**
 * Apply the chart selector's current value: a numeric "0".."5" picks
 * v_k as the chart denominator with PCA axes; "auto" runs the overall PCA.
 */
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
currentProj = fitPCAChartEmbedding(currentOrbit, 0);  // v₁ chart with PCA axes
rebuildMesh(true);

// ─── HUD ────────────────────────────────────────────────────────────────────

const panel = new ControlPanel({ title: 'Sp(6,Z) — limit sets' });

panel.select({
  label: 'example',
  options: EXAMPLES.map((e) => ({ value: e.id, label: `${e.label} (${e.nature})` })),
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
  min: 4, max: 13, step: 1, value: depth,
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
    { value: '0', label: 'v₁ chart (PCA axes)' },
    { value: '1', label: 'v₂ chart (PCA axes)' },
    { value: '2', label: 'v₃ chart (PCA axes)' },
    { value: '3', label: 'v₄ chart (PCA axes)' },
    { value: '4', label: 'v₅ chart (PCA axes)' },
    { value: '5', label: 'v₆ chart (PCA axes)' },
    { value: 'auto', label: 'auto-chart (overall PCA)' },
  ],
  value: '0',
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
    selChart.set('0');
    slFov.set(DEFAULT_FOV);
    app.camera.fov = DEFAULT_FOV;
    app.camera.updateProjectionMatrix();
    regenerateOrbit(depth);
    applyChartSelection('0');
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
      `sp6-${currentExample.id}_${currentProj.label}_${stats.kept}pts_${shotTimestamp()}.png`,
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
    `α = ${currentExample.alpha}<br>` +
    `β = ${currentExample.beta}<br>` +
    `γ = ${currentExample.gammaName}`,
  );
}

// ─── Export view for offline render ─────────────────────────────────────────
//
// Serialize current state to a JSON object that the offline render script
// (scripts/sp6-render-limit-set.mjs) can consume verbatim. The chart matrix
// (denom + 3 rows) is captured so the offline render uses the *same*
// projection axes even though it'll BFS at a different depth.

async function exportView(): Promise<void> {
  const cam = app.camera as THREE.PerspectiveCamera;
  const tgt = app.controls.target;
  const canvas = app.renderManager.renderer.domElement;
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
    camera: {
      position: [cam.position.x, cam.position.y, cam.position.z],
      target:   [tgt.x, tgt.y, tgt.z],
      up:       [cam.up.x, cam.up.y, cam.up.z],
      fov:      cam.fov,
      aspect:   cam.aspect,
      near:     cam.near,
      far:      cam.far,
    },
    viewport: {
      width:  canvas.clientWidth,
      height: canvas.clientHeight,
    },
  };
  const json = JSON.stringify(bundle, null, 2);
  console.log('[sp6-render] view JSON:\n' + json);

  // Primary path: POST to the Vite dev-server middleware, which writes the
  // JSON straight to scripts/sp6-view-preset.json. Falls back to clipboard if
  // the middleware is unavailable (e.g. running the built bundle).
  let saved = false;
  try {
    const r = await fetch('/__save-view/sp6', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: json,
    });
    if (r.ok) {
      saved = true;
      exportStatus.flash(
        'saved to scripts/sp6-view-preset.json — run `node scripts/sp6-render-limit-set.ts`',
        2500, '#9ec79e',
      );
    }
  } catch { /* fall through to clipboard */ }

  if (!saved) {
    try {
      await navigator.clipboard.writeText(json);
      exportStatus.flash('dev server unavailable — copied to clipboard instead', 2500, '#d9a55c');
    } catch {
      exportStatus.flash('clipboard blocked — see console for JSON', 2500, '#d9a55c');
    }
  }
}

updateUI();

app.start();
