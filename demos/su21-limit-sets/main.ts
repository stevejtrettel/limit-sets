/**
 * SU(2,1) — limit sets on ∂CH² = S³, the boundary of complex hyperbolic
 * 2-space (ball model B⁴ ⊂ C²).
 *
 * Pick an example (ideal triangle groups by Cartan invariant, C-Fuchsian
 * Schottky), BFS depth, boundary picture (stereographic S³ by default,
 * Heisenberg coordinates as alternative), and color scheme. The orbit
 * auto-fits the camera on every change.
 *
 * The "save view" button serialises the current camera + example/depth +
 * embedding choice as JSON; the dev-server middleware writes it to
 * outputs/presets/su21-view-preset.json for the offline render script.
 *
 * Only the family imports are group-specific — everything else (orbit
 * walker, instanced spheres, autofit, color schemes) is core / app / render.
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

import { stereographicEmbedding, heisenbergEmbedding } from '@/examples/complex-hyperbolic/embedding';
import {
  EXAMPLES, exampleById, buildAction, seedSU21, type SU21Example,
} from '@/examples/complex-hyperbolic/examples';
import { paletteForScheme } from '@/examples/complex-hyperbolic/palette';
import { validateAllExamples } from '@/examples/complex-hyperbolic/validate';
import type { EmbeddingName, ViewPreset } from '@/examples/complex-hyperbolic/viewPreset';

validateAllExamples(EXAMPLES);

const app = new App({ antialias: true });
app.scene.background = new THREE.Color(0xffffff);

const { material, uniforms } = createSphereMaterial();

const DEFAULT_EXAMPLE_ID = 'ideal-triangle-A45';
const DEFAULT_DEPTH       = 12;
const DEFAULT_RADIUS      = 0.005;
const DEFAULT_EMBEDDING: EmbeddingName = 'sphere-stereo';

// ─── State ──────────────────────────────────────────────────────────────────

let currentExample!:   SU21Example;
let currentAction!:    GroupAction;
let currentBasepoint!: Float64Array;
let currentOrbit!:     Orbit;
let currentEmbedding!: SceneEmbedding;
let currentEmbeddingName: EmbeddingName = DEFAULT_EMBEDDING;
let currentMesh: THREE.Mesh | null = null;
let depth = DEFAULT_DEPTH;
let colorDepth = 0;
let stats = { kept: 0, totalWords: 0 };
let currentSeedName = '';

const EMBEDDINGS: Record<EmbeddingName, SceneEmbedding> = {
  'sphere-stereo': stereographicEmbedding,
  'heisenberg':    heisenbergEmbedding,
};

/** Both pictures are genuinely 3D — off-axis perspective for each. */
const AUTOFIT_DIR: Record<EmbeddingName, readonly [number, number, number]> = {
  'sphere-stereo': [0.4, 0.4, 1],
  'heisenberg':    [0.7, 0.4, 0.6],
};

function loadExample(id: string): void {
  currentExample = exampleById(id);
  currentAction = buildAction(currentExample);
  const s = seedSU21(currentExample, currentAction);
  currentBasepoint = s.basepoint;
  currentSeedName = s.name;
  console.log(
    `[su21-${currentExample.id}] loaded: γ = ${s.name}, |λ_max| ≈ ${s.lambdaMax.toFixed(3)}`,
  );
}

function regenerateOrbit(N: number): void {
  const t0 = performance.now();
  currentOrbit = generateOrbit(currentAction, currentBasepoint, N);
  const t1 = performance.now();
  console.log(
    `[su21-${currentExample.id}] BFS depth=${N}  words=${currentOrbit.count}  (${(t1 - t0).toFixed(0)}ms)`,
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

const panel = new ControlPanel({ title: 'SU(2,1) — limit sets on ∂CH²' });

panel.select({
  label: 'example',
  options: EXAMPLES.map((e) => ({ value: e.id, label: e.label })),
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

panel.separator();

const slDepth = panel.slider({
  label: 'depth N',
  min: 4, max: 17, step: 1, value: depth,
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
    { value: 'sphere-stereo', label: 'S³ stereographic' },
    { value: 'heisenberg',    label: 'Heisenberg group' },
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
      `su21-${currentExample.id}_${currentEmbedding.label}_${stats.kept}pts_${shotTimestamp()}.png`,
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
  await saveViewPreset('su21', bundle, (msg, ok) =>
    exportStatus.flash(msg, 2500, ok ? '#9ec79e' : '#d9a55c'));
}

updateUI();

app.start();
