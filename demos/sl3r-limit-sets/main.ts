/**
 * SL(3,R) — convex real projective limit-set viewer.
 *
 * Pipeline (all of this is generic — only the action and embeddings are
 * sl3r-specific):
 *   1. pick a Coxeter triangle group at parameter d
 *   2. find ξ₊(γ) ∈ Λ via power-iteration of a loxodromic γ word
 *   3. walk the non-backtracking word tree from ξ₊
 *   4. embed each orbit state to R³ (affine chart for the flat picture,
 *      or unit S² for the sphere-cover picture)
 *   5. instanced spheres + autofit camera
 *
 * Default view is the plane (affine chart); the limit set of a convex
 * projective Coxeter group is the boundary of a convex domain in RP².
 *
 * The "copy view JSON" button posts the framed view to
 * /__save-view/sl3r → scripts/sl3r-view-preset.json for the offline render.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { ControlPanel } from '@/app/ControlPanel';
import { createSphereMaterial } from '@/app/instancedSpheres';
import { buildLimitSetMesh } from '@/app/limitSetMesh';
import { cameraSpecFromApp, viewportFromApp, saveViewPreset } from '@/app/viewExport';

import type { GroupAction } from '@/core/group';
import { generateOrbit, type Orbit } from '@/core/orbit';
import type { SceneEmbedding } from '@/core/scene';

import { schemeForColorDepth } from '@/render/colorScheme.ts';

import { makeMatrixAction, asInvolutions, pairWithInverses } from '@/core/matrixAction';
import { sphereEmbedding, planeEmbedding } from '@/examples/projective/triangle-groups/embeddings';
import {
  EXAMPLES, exampleById, makeLiveTri334, seedTriangle, type MatrixGroupExample,
} from '@/examples/projective/triangle-groups/data';
import { paletteForScheme } from '@/examples/projective/triangle-groups/palette';
import { validateAllExamples } from '@/examples/projective/triangle-groups/validate';
import type { EmbeddingName, ViewPreset } from '@/examples/projective/triangle-groups/viewPreset';

/** Sentinel dropdown id that means "live triangle, driven by the d slider". */
const LIVE_TRI_ID = 'tri-334-live';
const DEFAULT_D   = 1.0;
const D_MIN       = 0.55;
const D_MAX       = 1.95;
const D_STEP      = 0.005;

validateAllExamples(EXAMPLES);

const app = new App({ antialias: true });
app.scene.background = new THREE.Color(0xffffff);

const { material, uniforms } = createSphereMaterial();

const DEFAULT_EXAMPLE_ID = LIVE_TRI_ID;
const DEFAULT_DEPTH       = 12;   // 3 involutions: 3·2¹² − 2 = 12 286 nodes → live-responsive
const DEFAULT_RADIUS      = 0.005;
const DEFAULT_EMBEDDING: EmbeddingName = 'plane';

// ─── State ──────────────────────────────────────────────────────────────────

let currentExample!:   MatrixGroupExample;
let currentAction!:    GroupAction;
let currentBasepoint!: Float64Array;
let currentOrbit!:     Orbit;
let currentEmbedding!: SceneEmbedding;
let currentEmbeddingName: EmbeddingName = DEFAULT_EMBEDDING;
let currentMesh: THREE.Mesh | null = null;
let depth = DEFAULT_DEPTH;
let colorDepth = 0;
let stats = { kept: 0, totalWords: 0 };
/** d parameter for the live (3,3,4) triangle family. */
let currentD = DEFAULT_D;
let currentSeedName = '';

const EMBEDDINGS: Record<EmbeddingName, SceneEmbedding> = {
  sphere: sphereEmbedding,
  plane:  planeEmbedding,
};

const AUTOFIT_DIR: Record<EmbeddingName, readonly [number, number, number]> = {
  sphere: [0.4, 0.4, 1],
  plane:  [0, 0, 1],
};

/**
 * Load by dropdown id, OR by the special LIVE_TRI_ID sentinel which builds
 * the (3,3,4) triangle group from the current d-slider value.
 */
function loadExample(id: string): void {
  currentExample = id === LIVE_TRI_ID
    ? makeLiveTri334(currentD)
    : exampleById(id);
  currentAction = makeMatrixAction(
    currentExample.involutions
      ? asInvolutions(currentExample.generators)
      : pairWithInverses(currentExample.generators),
  );
  const s = seedTriangle(currentAction);
  currentBasepoint = s.basepoint;
  currentSeedName = s.name;
  console.log(
    `[sl3r-${currentExample.id}] loaded: γ = ${s.name}, |λ_max| ≈ ${s.lambdaMax.toFixed(3)}, ` +
    `drift = ${s.drift.toFixed(4)}`,
  );
}

function regenerateOrbit(N: number): void {
  const t0 = performance.now();
  currentOrbit = generateOrbit(currentAction, currentBasepoint, N);
  const t1 = performance.now();
  console.log(
    `[sl3r-${currentExample.id}] BFS depth=${N}  words=${currentOrbit.count}  (${(t1 - t0).toFixed(0)}ms)`,
  );
}

function rebuildMesh(autofit: boolean): void {
  const { mesh, kept } = buildLimitSetMesh({
    app, material, embedding: currentEmbedding, orbit: currentOrbit,
    colorDepth, paletteForScheme, previous: currentMesh, autofit,
    autofitDir: AUTOFIT_DIR[currentEmbeddingName],
  });
  currentMesh = mesh;
  stats = { kept, totalWords: currentOrbit.count };
}

function setEmbedding(name: EmbeddingName): void {
  currentEmbeddingName = name;
  currentEmbedding = EMBEDDINGS[name];
}

// ─── Initial load ───────────────────────────────────────────────────────────

setEmbedding(DEFAULT_EMBEDDING);
loadExample(DEFAULT_EXAMPLE_ID);
regenerateOrbit(depth);
rebuildMesh(true);

// ─── HUD ────────────────────────────────────────────────────────────────────

const panel = new ControlPanel({ title: 'SL(3,R) — limit sets' });

const EXAMPLE_OPTIONS = [
  { value: LIVE_TRI_ID, label: '(3,3,4) triangle — live d slider' },
  ...EXAMPLES.map((e) => ({ value: e.id, label: e.label })),
];

const selExample = panel.select({
  label: 'example',
  options: EXAMPLE_OPTIONS,
  value: DEFAULT_EXAMPLE_ID,
  onChange: (id) => {
    loadExample(id);
    slDepth.set(DEFAULT_DEPTH);
    depth = DEFAULT_DEPTH;
    regenerateOrbit(depth);
    rebuildMesh(true);
    updateUI();
  },
});
const exMeta = panel.text({ variant: 'meta' });

// Live d slider for the (3,3,4) triangle family. Range avoids the
// singularities at 0, ½, 2; step is small enough to feel continuous.
// Dragging snaps the example into live-triangle mode if not already there.
const slD = panel.slider({
  label: 'd (triangle deformation)',
  min: D_MIN, max: D_MAX, step: D_STEP, value: currentD,
  format: (v) => v.toFixed(3),
  event: 'input',
  onChange: (v) => {
    currentD = v;
    if (selExample.value !== LIVE_TRI_ID) selExample.set(LIVE_TRI_ID);
    loadExample(LIVE_TRI_ID);
    regenerateOrbit(depth);
    rebuildMesh(true);
    updateUI();
  },
});

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
  min: 0.0005, max: 0.05, step: 0.0005, value: DEFAULT_RADIUS,
  format: (v) => v.toFixed(4),
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

const selEmbedding = panel.select({
  label: 'view',
  options: [
    { value: 'plane',  label: 'affine chart (x/z, y/z)' },
    { value: 'sphere', label: 'projective sphere (S²)' },
  ],
  value: DEFAULT_EMBEDDING,
  onChange: (v) => {
    setEmbedding(v as EmbeddingName);
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
    selEmbedding.set(DEFAULT_EMBEDDING);
    slFov.set(DEFAULT_FOV);
    app.camera.fov = DEFAULT_FOV;
    app.camera.updateProjectionMatrix();
    setEmbedding(DEFAULT_EMBEDDING);
    currentD = DEFAULT_D;
    slD.set(DEFAULT_D);
    selExample.set(LIVE_TRI_ID);
    loadExample(LIVE_TRI_ID);
    regenerateOrbit(depth);
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
      `sl3r-${currentExample.id}_${currentEmbedding.label}_${stats.kept}pts_${shotTimestamp()}.png`,
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
  modeEl.text(`view: ${currentEmbedding.pretty}`);
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
    colorScheme:  schemeForColorDepth(colorDepth).name,
    embedding:    currentEmbeddingName,
    camera:       cameraSpecFromApp(app),
    viewport:     viewportFromApp(app),
  };
  await saveViewPreset('sl3r', bundle, (msg, ok) =>
    exportStatus.flash(msg, 2500, ok ? '#9ec79e' : '#d9a55c'));
}

updateUI();

app.start();
