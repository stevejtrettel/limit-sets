/**
 * SL(2,C) — quasifuchsian and Kleinian limit-set viewer.
 *
 * Pick an example, BFS depth, scene embedding (stereographic plane by
 * default, Riemann sphere as alternative), and color scheme. The orbit
 * auto-fits the camera on every change (top-down for plane, off-axis
 * perspective for sphere).
 *
 * The "save view" button serialises the current camera + example/depth +
 * embedding choice as JSON; the dev-server middleware writes it to
 * scripts/sl2c-view-preset.json, which the offline render script picks up.
 *
 * This demo is the test bed for the post-sp6 generic pipeline: only the
 * `makeMobiusAction`, the two embeddings, and the example data are
 * group-specific. Everything else (orbit walker, instanced spheres,
 * autofit, color schemes) is imported from core / app / render.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { ControlPanel } from '@/app/ControlPanel';
import { createSphereMaterial, makeInstancedSpheres } from '@/app/instancedSpheres';
import { autofitCamera } from '@/app/autofit';

import type { GroupAction } from '@/core/group';
import {
  computeProximalBasepoint, generateOrbit, type Orbit,
} from '@/core/orbit';
import type { SceneEmbedding } from '@/core/scene';

import { schemeForColorDepth } from '@/render/colorScheme.ts';
import { buildOrbitInstances } from '@/render/orbitInstances.ts';

import { makeMobiusAction } from '@/sl2c/action';
import { sphereEmbedding, planeEmbedding } from '@/sl2c/embedding';
import {
  EXAMPLES, exampleById, type MobiusExample,
} from '@/sl2c/examples';
import { paletteForScheme } from '@/sl2c/palettes';
import { validateAllExamples } from '@/sl2c/validate';
import type { EmbeddingName, ViewPreset } from '@/sl2c/viewPreset';

validateAllExamples(EXAMPLES);

const app = new App({ antialias: true });
app.scene.background = new THREE.Color(0xffffff);

const { material, uniforms } = createSphereMaterial();

const DEFAULT_EXAMPLE_ID = 'riley-2i';
const DEFAULT_DEPTH       = 12;
const DEFAULT_RADIUS      = 0.005;
const DEFAULT_EMBEDDING: EmbeddingName = 'plane';

// ─── State ──────────────────────────────────────────────────────────────────

let currentExample!:   MobiusExample;
let currentAction!:    GroupAction;
let currentBasepoint!: Float64Array;
let currentOrbit!:     Orbit;
let currentEmbedding!: SceneEmbedding;
let currentEmbeddingName: EmbeddingName = DEFAULT_EMBEDDING;
let currentMesh: THREE.Mesh | null = null;
let depth = DEFAULT_DEPTH;
let colorDepth = 0;
let stats = { kept: 0, totalWords: 0 };

const EMBEDDINGS: Record<EmbeddingName, SceneEmbedding> = {
  sphere: sphereEmbedding,
  plane:  planeEmbedding,
};

/** Top-down for plane (curve is flat in z=0); off-axis perspective for sphere. */
const AUTOFIT_DIR: Record<EmbeddingName, readonly [number, number, number]> = {
  sphere: [0.4, 0.4, 1],
  plane:  [0, 0, 1],
};

function loadExample(id: string): void {
  currentExample = exampleById(id);
  currentAction = makeMobiusAction(currentExample.generators);
  const r = computeProximalBasepoint(currentAction, currentExample.gamma, currentExample.powerIter);
  currentBasepoint = r.basepoint;
  console.log(
    `[sl2c-${currentExample.id}] loaded: |λ_max(${currentExample.gammaName})| ≈ ${r.lambdaMax.toFixed(3)}, ` +
    `drift = ${r.drift.toFixed(4)}`,
  );
}

function regenerateOrbit(N: number): void {
  const t0 = performance.now();
  currentOrbit = generateOrbit(currentAction, currentBasepoint, N);
  const t1 = performance.now();
  console.log(
    `[sl2c-${currentExample.id}] BFS depth=${N}  words=${currentOrbit.count}  (${(t1 - t0).toFixed(0)}ms)`,
  );
}

function rebuildMesh(autofit: boolean): void {
  const scheme = schemeForColorDepth(colorDepth);
  const palette = paletteForScheme(scheme.name);
  const { aPos, aColor, kept } = buildOrbitInstances(
    currentEmbedding, currentOrbit, scheme, palette,
  );

  const mesh = makeInstancedSpheres(material, aPos, aColor);
  if (currentMesh) {
    app.scene.remove(currentMesh);
    currentMesh.geometry.dispose();
  }
  app.scene.add(mesh);
  currentMesh = mesh;

  if (autofit) autofitCamera(app, aPos, kept, { dir: AUTOFIT_DIR[currentEmbeddingName] });

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

const panel = new ControlPanel({ title: 'SL(2,C) — limit sets' });

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
    { value: 'plane',  label: 'stereographic plane' },
    { value: 'sphere', label: 'Riemann sphere' },
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
      `sl2c-${currentExample.id}_${currentEmbedding.label}_${stats.kept}pts_${shotTimestamp()}.png`,
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
    `γ = ${currentExample.gammaName}`,
  );
}

// ─── Export view for offline render ─────────────────────────────────────────
//
// Serialises the current state to a JSON object that scripts/sl2c-render-
// limit-set.ts can consume verbatim. The chosen embedding is named (sphere
// or plane); the offline script looks up the same embedding object.

async function exportView(): Promise<void> {
  const cam = app.camera as THREE.PerspectiveCamera;
  const tgt = app.controls.target;
  const canvas = app.renderManager.renderer.domElement;
  const bundle: ViewPreset = {
    exampleId:    currentExample.id,
    previewDepth: depth,
    colorScheme:  schemeForColorDepth(colorDepth).name,
    embedding:    currentEmbeddingName,
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
  console.log('[sl2c-render] view JSON:\n' + json);

  let saved = false;
  try {
    const r = await fetch('/__save-view/sl2c', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: json,
    });
    if (r.ok) {
      saved = true;
      exportStatus.flash(
        'saved to scripts/sl2c-view-preset.json — run `node scripts/sl2c-render-limit-set.ts`',
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
