/**
 * SL(7,ℝ) Goldman–Parker triple — the limit set on its INVARIANT RP².
 *
 * The three 7×7 involutions are reducible: their common invariant subspace is
 * 3-dimensional, so the limit set really lives in RP². This viewer performs the
 * reduction in code — `restrictToRP2` builds the 7×7 action, auto-seeds, and
 * restricts to the orbit span via the generic core ability — then draws the
 * honest 3×3 representation ⟨C₁, C₂, C₃⟩ ⊂ SL(3,ℝ). The restricted generators
 * are projective reflections (det +1, spectrum (+1,−1,−1)), so this is a
 * real-projective reflection group.
 *
 * Two views, both rendered in R³ (three.js):
 *   - plane  : the affine chart (x/z, y/z) — a plain planar projection. The set
 *              covers RP², so a few points cross this chart's line at infinity;
 *              the autofit's 15–85 percentile bbox lets those tails fall off the
 *              edge. DEFAULT.
 *   - sphere : the unit-S² projective sphere — always bounded, both antipodal
 *              copies visible.
 *
 * The "copy view JSON" button posts to /__save-view/sl7rp2 →
 * outputs/presets/sl7rp2-view-preset.json for the offline render.
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

import { sphereEmbedding, planeEmbedding } from '@/examples/projective/rp2';
import { EXAMPLES, exampleById } from '@/examples/projective/rp6-triples/data';
import { restrictToRP2, type RP2Restriction } from '@/examples/projective/rp6-triples/rp2';
import { paletteForScheme } from '@/examples/projective/rp6-triples/palette';
import type { EmbeddingName, ViewPreset } from '@/examples/projective/rp6-triples/rp2ViewPreset';

const app = new App({ antialias: true });
app.scene.background = new THREE.Color(0xffffff);

const { material, uniforms } = createSphereMaterial();

const DEFAULT_EXAMPLE_ID = 'goldman-parker-7';
const DEFAULT_DEPTH       = 15;   // 3 involutions: 3·2¹⁴ − 2 ≈ 49k nodes
const DEFAULT_RADIUS      = 0.004;
const DEFAULT_EMBEDDING: EmbeddingName = 'plane';
/** basepoint + 3 involution colors — K for the last-gen / kth-last schemes. */
const CATEGORY_COUNT = 4;

const EMBEDDINGS: Record<EmbeddingName, SceneEmbedding> = {
  plane:  planeEmbedding,
  sphere: sphereEmbedding,
};

const AUTOFIT_DIR: Record<EmbeddingName, readonly [number, number, number]> = {
  plane:  [0, 0, 1],
  sphere: [0.4, 0.4, 1],
};

// ─── State ──────────────────────────────────────────────────────────────────

let currentId = DEFAULT_EXAMPLE_ID;
let restriction!:      RP2Restriction;
let currentAction!:    GroupAction;
let currentBasepoint!: Float64Array;
let currentOrbit!:     Orbit;
let currentEmbedding!: SceneEmbedding;
let currentEmbeddingName: EmbeddingName = DEFAULT_EMBEDDING;
let currentMesh: THREE.Mesh | null = null;
let depth = DEFAULT_DEPTH;
let colorDepth = 0;
let stats = { kept: 0, totalWords: 0 };

function loadExample(id: string): void {
  currentId = id;
  restriction = restrictToRP2(exampleById(id));
  currentAction = restriction.action;
  currentBasepoint = restriction.basepoint;
  console.log(
    `[sl7rp2-${id}] restricted 7×7 → ${restriction.dim}×${restriction.dim} on RP²  ` +
    `(invariance residual ${restriction.invarianceResidual.toExponential(2)}, ` +
    `spectral gap ${restriction.spectralGap === Infinity ? '∞' : restriction.spectralGap.toExponential(2)})  ` +
    `γ = ${restriction.seedName}, |λ_max| ≈ ${restriction.lambdaMax.toFixed(3)}`,
  );
}

function regenerateOrbit(N: number): void {
  const t0 = performance.now();
  currentOrbit = generateOrbit(currentAction, currentBasepoint, N);
  const t1 = performance.now();
  console.log(`[sl7rp2-${currentId}] BFS depth=${N}  words=${currentOrbit.count}  (${(t1 - t0).toFixed(0)}ms)`);
}

function setEmbedding(name: EmbeddingName): void {
  currentEmbeddingName = name;
  currentEmbedding = EMBEDDINGS[name];
}

function rebuildMesh(autofit: boolean): void {
  const { mesh, kept } = buildLimitSetMesh({
    app, material, embedding: currentEmbedding, orbit: currentOrbit,
    colorDepth, categoryCount: CATEGORY_COUNT, paletteForScheme,
    previous: currentMesh, autofit, autofitDir: AUTOFIT_DIR[currentEmbeddingName],
  });
  currentMesh = mesh;
  stats = { kept, totalWords: currentOrbit.count };
}

// ─── Initial load ───────────────────────────────────────────────────────────

loadExample(DEFAULT_EXAMPLE_ID);
setEmbedding(DEFAULT_EMBEDDING);
regenerateOrbit(depth);
rebuildMesh(true);

// ─── HUD ────────────────────────────────────────────────────────────────────

const panel = new ControlPanel({ title: 'SL(7,ℝ) triple — limit set on invariant RP²' });

panel.select({
  label: 'example',
  options: EXAMPLES.map((e) => ({ value: e.id, label: e.label })),
  value: DEFAULT_EXAMPLE_ID,
  onChange: (id) => {
    loadExample(id);
    depth = DEFAULT_DEPTH;
    slDepth.set(DEFAULT_DEPTH);
    regenerateOrbit(depth);
    rebuildMesh(true);
    updateUI();
  },
});
const exMeta = panel.text({ variant: 'meta' });

panel.separator();

const slDepth = panel.slider({
  label: 'depth N',
  min: 4, max: 20, step: 1, value: depth,
  onChange: (v) => {
    depth = v;
    regenerateOrbit(v);
    rebuildMesh(false);
    updateUI();
  },
});

panel.slider({
  label: 'ball radius',
  min: 0.001, max: 0.04, step: 0.0005, value: DEFAULT_RADIUS,
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
      `sl7rp2-${currentId}_${currentEmbedding.label}_${stats.kept}pts_${shotTimestamp()}.png`,
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
  statsEl.text(`${stats.totalWords.toLocaleString()} words, ${stats.kept.toLocaleString()} drawn`);
  modeEl.text(`view: ${currentEmbedding.pretty}`);
  exMeta.html(
    `7×7 restricted to invariant RP² (dim V = ${restriction.dim}, ` +
    `residual ${restriction.invarianceResidual.toExponential(1)})<br>` +
    `γ = ${restriction.seedName}, |λ_max| ≈ ${restriction.lambdaMax.toFixed(3)}`,
  );
}

// ─── Export view for offline render ─────────────────────────────────────────

async function exportView(): Promise<void> {
  const bundle: ViewPreset = {
    exampleId:    currentId,
    previewDepth: depth,
    colorScheme:  schemeForColorDepth(colorDepth, CATEGORY_COUNT).name,
    embedding:    currentEmbeddingName,
    camera:       cameraSpecFromApp(app),
    viewport:     viewportFromApp(app),
  };
  await saveViewPreset('sl7rp2', bundle, (msg, ok) =>
    exportStatus.flash(msg, 2500, ok ? '#9ec79e' : '#d9a55c'));
}

updateUI();

app.start();
