/**
 * Schwartz–Pappus limit-set viewer — RP² (sphere-cover model).
 *
 * Sweeps the Z/3 ∗ Z/3 ⊂ Z/2 ∗ Z/3 index-2 subgroup of the modular group
 * from the Pappus boundary of the Barbot component (b = 1) into the
 * Anosov interior, along the duality curve γ_{c,d} ⊂ Θ. UI:
 *   - c, d ∈ (-1, 1)²    Pappus / marked-box parameters
 *   - b ∈ [1, 3]         BLV morphing magnitude; a auto-solved from ψ=0
 *
 * Pipeline at each parameter change:
 *   1. Solve a ← ψ⁻¹(0; b, c, d) on the Anosov branch
 *   2. Build (g₁, g₂) = (r₁, Σ⁻¹·r₂·Σ)
 *   3. Hand to the generic 2-letter F₂ walker (makeMat3Action, no special
 *      Z/3-aware enumeration — see plan; overcounting accepted at v1)
 *   4. Power-iterate γ = r₁·r₂² for the basepoint, BFS the orbit
 *   5. Plane embedding (x/z, y/z) + instanced spheres
 *
 * Validation: §7 trace identities and duality polynomial sanity checks
 * run at module load and throw on any failure.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { ControlPanel } from '@/app/ControlPanel';
import { createSphereMaterial, makeInstancedSpheres } from '@/app/instancedSpheres';
import { autofitCamera } from '@/app/autofit';

import type { GroupAction } from '@/core/group';
import { generateOrbit, type Orbit } from '@/core/orbit';
import type { SceneEmbedding } from '@/core/scene';
import { makeMatrixAction, pairWithInverses } from '@/core/matrixAction';
import type { Mat } from '@/core/matrix';

import { schemeForColorDepth } from '@/render/colorScheme';
import { buildOrbitInstances } from '@/render/orbitInstances';

import { sphereEmbedding, planeEmbedding } from '@/examples/projective/rp2';
import { paletteForScheme } from '@/examples/projective/schwartz-pappus/palette';
import { pappusRep, seedPappus, PAPPUS_SEED } from '@/examples/projective/schwartz-pappus/recipe';
import { validatePappus } from '@/examples/projective/schwartz-pappus/validate';
import type {
  SchwartzPappusViewPreset, Mat3Json, PappusEmbeddingName,
} from './viewPreset';
// Flag-variety viz is being reworked — see demos/schwartz-pappus/flagEmbedding.ts
// for the skeleton of three approaches (decorated 2D, dual scatter, folded 3D).
// flagAction.ts has the correct 6-dim action + dual action, ready to wire in.

// ── Validation — fails loud at startup if any §7 identity is off ──────────
validatePappus();

// ── Defaults ────────────────────────────────────────────────────────────────
const DEFAULT_C = 0.2;
const DEFAULT_D = 0.4;
const DEFAULT_B = 1.0;
const C_MIN = -0.95, C_MAX = 0.95, C_STEP = 0.001;
const D_MIN = -0.95, D_MAX = 0.95, D_STEP = 0.001;
const B_MIN = 1.0,   B_MAX = 3.0,  B_STEP = 0.001;

const DEFAULT_DEPTH    = 10;
const DEFAULT_RADIUS   = 0.005;
const DEFAULT_EMBEDDING: PappusEmbeddingName = 'plane';

const EMBEDDINGS: Record<PappusEmbeddingName, SceneEmbedding> = {
  sphere: sphereEmbedding,
  plane:  planeEmbedding,
};

const AUTOFIT_DIR: Record<PappusEmbeddingName, readonly [number, number, number]> = {
  sphere: [0.4, 0.4, 1],
  plane:  [0, 0, 1],
};

// ── App / scene setup ──────────────────────────────────────────────────────
const app = new App({ antialias: true });
app.scene.background = new THREE.Color(0xffffff);
const { material, uniforms } = createSphereMaterial();

// ── State ──────────────────────────────────────────────────────────────────
let c = DEFAULT_C;
let d = DEFAULT_D;
let b = DEFAULT_B;
let aSolved = 1;

let currentGenerators!: readonly Mat[];
let currentSeedName = '';
let currentAction!:    GroupAction;
let currentBasepoint!: Float64Array;
let currentOrbit!:     Orbit;
let currentEmbedding!: SceneEmbedding;
let currentEmbeddingName: PappusEmbeddingName = DEFAULT_EMBEDDING;
let currentMesh: THREE.Mesh | null = null;

let depth = DEFAULT_DEPTH;
let colorDepth = 0;
let stats = { kept: 0, totalWords: 0 };
let lambdaMax = NaN;
let drift = NaN;

// ── Pipeline ───────────────────────────────────────────────────────────────

function setEmbedding(name: PappusEmbeddingName): void {
  currentEmbeddingName = name;
  currentEmbedding = EMBEDDINGS[name];
}

/** rebuild generators, power-iterate γ, regenerate orbit. */
function rebuildRep(): void {
  const built = pappusRep(c, d, b);
  currentGenerators = built.generators;
  aSolved           = built.a;
  currentAction     = makeMatrixAction(pairWithInverses(built.generators));
  const s = seedPappus(currentAction);
  currentBasepoint = s.basepoint;
  currentSeedName  = s.name;
  lambdaMax        = s.lambdaMax;
  drift            = s.drift;
}

function regenerateOrbit(N: number): void {
  currentOrbit = generateOrbit(currentAction, currentBasepoint, N);
}

function rebuildMesh(autofit: boolean): void {
  const scheme  = schemeForColorDepth(colorDepth);
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

/** Full rebuild on (c, d, b) change. */
function repipeline(autofit: boolean): void {
  rebuildRep();
  regenerateOrbit(depth);
  rebuildMesh(autofit);
  updateUI();
}

// ── Initial load ───────────────────────────────────────────────────────────
setEmbedding(DEFAULT_EMBEDDING);

// ── HUD ────────────────────────────────────────────────────────────────────
const panel = new ControlPanel({ title: 'Schwartz–Pappus — SL(3,R) limit sets on RP²' });
const modeEl  = panel.text({ variant: 'mode' });
const statsEl = panel.text({ variant: 'stats' });

// ── Pappus parameters (c, d) ───────────────────────────────────────────────
const pappusFolder = panel.folder('Pappus parameters (c, d)', { open: true });
const slC = pappusFolder.slider({
  label: 'c',
  min: C_MIN, max: C_MAX, step: C_STEP, value: c,
  format: (v) => v.toFixed(3),
  event: 'input',
  onChange: (v) => { c = v; safeRepipeline(false); },
});
const slD = pappusFolder.slider({
  label: 'd',
  min: D_MIN, max: D_MAX, step: D_STEP, value: d,
  format: (v) => v.toFixed(3),
  event: 'input',
  onChange: (v) => { d = v; safeRepipeline(false); },
});
const pappusMeta = pappusFolder.text({ variant: 'meta' });

// ── Morphing / Anosov sweep (b) ────────────────────────────────────────────
const morphFolder = panel.folder('Morphing (b ↦ a along γ_{c,d})', { open: true });
const slB = morphFolder.slider({
  label: 'b',
  min: B_MIN, max: B_MAX, step: B_STEP, value: b,
  format: (v) => v.toFixed(3),
  event: 'input',
  onChange: (v) => { b = v; safeRepipeline(false); },
});
const morphMeta = morphFolder.text({ variant: 'meta' });

// ── View (depth / camera / radius) ────────────────────────────────────────
const viewFolder = panel.folder('View');
const slDepth = viewFolder.slider({
  label: 'depth N',
  min: 4, max: 14, step: 1, value: depth,
  onChange: (v) => { depth = v; regenerateOrbit(v); rebuildMesh(false); updateUI(); },
});
viewFolder.slider({
  label: 'ball radius',
  min: 0.0005, max: 0.05, step: 0.0005, value: DEFAULT_RADIUS,
  format: (v) => v.toFixed(4),
  event: 'input',
  onChange: (v) => { uniforms.uRadius.value = v; },
});
const DEFAULT_FOV = app.camera.fov;
const slFov = viewFolder.slider({
  label: 'fov',
  min: 0.5, max: 90, step: 0.5, value: DEFAULT_FOV,
  format: (v) => `${v}°`,
  event: 'input',
  onChange: (v) => {
    app.camera.fov = v;
    app.camera.updateProjectionMatrix();
  },
});
const selEmbedding = viewFolder.select({
  label: 'embedding',
  options: [
    { value: 'plane',  label: 'affine chart (x/z, y/z)' },
    { value: 'sphere', label: 'projective sphere (S²)' },
    // TODO (tomorrow): re-add flag visualization here once one of the
    // three approaches in flagEmbedding.ts is implemented.
  ],
  value: DEFAULT_EMBEDDING,
  onChange: (v) => {
    setEmbedding(v as PappusEmbeddingName);
    rebuildMesh(true);
    updateUI();
  },
});

// ── Color ──────────────────────────────────────────────────────────────────
const colorFolder = panel.folder('Color');
colorFolder.select({
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
  onChange: (v) => { colorDepth = parseInt(v, 10); rebuildMesh(false); updateUI(); },
});

// ── Actions ────────────────────────────────────────────────────────────────
const actionsFolder = panel.folder('Actions');
actionsFolder.button({
  label: 'reset',
  onClick: () => {
    c = DEFAULT_C; d = DEFAULT_D; b = DEFAULT_B;
    slC.set(c); slD.set(d); slB.set(b);
    depth = DEFAULT_DEPTH; slDepth.set(DEFAULT_DEPTH);
    setEmbedding(DEFAULT_EMBEDDING); selEmbedding.set(DEFAULT_EMBEDDING);
    slFov.set(DEFAULT_FOV);
    app.camera.fov = DEFAULT_FOV;
    app.camera.updateProjectionMatrix();
    safeRepipeline(true);
  },
});
actionsFolder.button({
  label: 'screenshot',
  onClick: () => {
    app.screenshot(
      `schwartz-pappus_c${c.toFixed(3)}_d${d.toFixed(3)}_b${b.toFixed(3)}` +
      `_${stats.kept}pts_${shotTimestamp()}.png`,
    );
  },
});

actionsFolder.button({
  label: 'copy view JSON for offline render',
  onClick: exportView,
});
const exportStatus = actionsFolder.text({ variant: 'meta' });

// ── Helpers ────────────────────────────────────────────────────────────────

function shotTimestamp(): string {
  return new Date().toISOString().replace(/[-:]|\..*/g, '').replace('T', '-');
}

/**
 * Wrap repipeline in a try/catch so a transient degenerate parameter
 * (e.g. sliding c past 0 while d is also 0) doesn't kill the page.
 * Surfaces the error in the meta lines instead.
 */
function safeRepipeline(autofit: boolean): void {
  try {
    repipeline(autofit);
  } catch (err) {
    pappusMeta.html(
      `<span style="color:#d9a55c">error: ${err instanceof Error ? err.message : String(err)}</span>`,
    );
  }
}

function updateUI(): void {
  statsEl.text(
    `${stats.totalWords.toLocaleString()} words, ` +
    `${stats.kept.toLocaleString()} drawn`,
  );
  modeEl.text(`view: ${currentEmbedding.pretty}`);
  pappusMeta.html(
    `(c, d) = (${c.toFixed(3)}, ${d.toFixed(3)})<br>` +
    `(0, 0) is excluded (totally symmetric Pappus is degenerate)`,
  );
  const phase = b === 1 ? 'Pappus boundary' : 'Anosov interior';
  morphMeta.html(
    `b = ${b.toFixed(3)} → a = ${aSolved.toFixed(6)} along γ_{c,d}<br>` +
    `phase: ${phase}<br>` +
    `|λ_max(γ=${currentSeedName})| = ${lambdaMax.toFixed(4)}, ` +
    `drift = ${drift.toExponential(2)}`,
  );
}

// ─── Export view for offline render ─────────────────────────────────────────

async function exportView(): Promise<void> {
  const cam = app.camera as THREE.PerspectiveCamera;
  const tgt = app.controls.target;
  const canvas = app.renderManager.renderer.domElement;
  const bundle: SchwartzPappusViewPreset = {
    exampleId:    'schwartz-pappus',
    previewDepth: depth,
    colorScheme:  schemeForColorDepth(colorDepth).name,
    embedding:    currentEmbeddingName,
    params:       { c, d, b, a: aSolved },
    generators:   currentGenerators.map(
      (m) => [[m[0], m[1], m[2]], [m[3], m[4], m[5]], [m[6], m[7], m[8]]] as unknown as Mat3Json,
    ),
    gamma:        [...PAPPUS_SEED],
    gammaName:    'r₁·r₂²',
    powerIter:    80,
    involutions:  false,
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
  console.log('[schwartz-pappus-render] view JSON:\n' + json);

  let saved = false;
  try {
    const r = await fetch('/__save-view/schwartz-pappus', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: json,
    });
    if (r.ok) {
      saved = true;
      exportStatus.flash(
        'saved to scripts/schwartz-pappus-view-preset.json — run ' +
        '`node scripts/schwartz-pappus-render-limit-set.ts`',
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

// ── Kick off ───────────────────────────────────────────────────────────────
safeRepipeline(true);

app.start();
