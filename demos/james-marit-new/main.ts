/**
 * James–Marit (new) demo — SL(4,R) limit sets in RP³ from a FIXED SO(2,1) rep.
 *
 * Unlike the original james-marit demo (which moved around the Teichmüller
 * moduli space of flat-torus reps and lifted a 2×2 Fuchsian rep through sym²),
 * this demo fixes one explicit SO(2,1) ⊂ SL(3,R) representation of the
 * once-punctured torus group, supplied directly as two 3×3 matrices
 * (see so21Rep.ts) — no SL(2,R) and no sym².
 *
 * The 4×4 representation is then built live from:
 *   1. ρ : F₂ → SO(2,1)            (the two fixed 3×3 matrices A, B)
 *   2. φ : F₂ → R                  (χ = exp(−φ); φ(a) = s·ℓ(a), φ(b) = 0)
 *   3. v : F₂ → R³ cocycle         (v_a, v_b in the kernel of v_{[a,b]} = 0)
 * The third piece lives in a generically 3-dim affine slice of R⁶;
 * three α-sliders move us around inside it.
 *
 * Fabi's affine chart (parameterised by t, scale) projects RP³ → R³ for
 * display.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { ControlPanel } from '@/app/ControlPanel';
import { createSphereMaterial, makeInstancedSpheres } from '@/app/instancedSpheres';
import { autofitCamera } from '@/app/autofit';

import type { SL4RExample } from '@/sl4r/types';
import {
  makeMat4Action, mat4Mul, mat4Inverse, type Mat4R,
} from '@/sl4r/action';
import { paletteForScheme } from '@/sl4r/palettes';
import type { JMViewPreset, JMRenderMode, Mat4Json } from './viewPreset';
import type { GroupAction } from '@/core/group';
import {
  computeProximalBasepoint, generateOrbit, type Orbit,
} from '@/core/orbit';
import {
  type ChartEmbedding,
  makeChartFromData,
} from '@/core/chart';
import { schemeForColorDepth } from '@/render/colorScheme';
import { buildOrbitInstances } from '@/render/orbitInstances';

import {
  type SO21Rep, DEFAULT_REP, defaultMultipliers,
} from './so21Rep';
import {
  type Cohomology, makeCohomology, DEFAULT_S,
} from './cohomology';
import {
  type Vec6, cocycleSpace, combineBasis,
} from './cocycle';
import { buildExample, scaledBlocks, type ScaledBlocks } from './repBuilder';
import { makeFabiChart, FABI_DEFAULT_T, FABI_DEFAULT_SCALE } from './fabiChart';

const app = new App({ antialias: true });
app.scene.background = new THREE.Color(0xffffff);

const DEFAULT_RADIUS = 0.06;
const { material, uniforms } = createSphereMaterial(DEFAULT_RADIUS);

const DEFAULT_DEPTH = 8;  // lower than sl4r-limit-sets because we regen on every slider tick

// ─── State ──────────────────────────────────────────────────────────────────

// The rep is FIXED: the two explicit SO(2,1) matrices in so21Rep.ts. There is
// no rep-mode toggle and no Teichmüller moduli space in this demo.
const rep: SO21Rep = DEFAULT_REP;

// kA, kB are derived inside recomputeBasis() from the fixed rep (kA = ℓ(a),
// kB = 0); this is just the initial display value.
let { kA, kB } = defaultMultipliers(rep);
let sCoh = DEFAULT_S;
let alphas: [number, number, number] = [0, 0, 0];

// Grayscale only — the color-by-letter selector was removed from the panel.
const colorDepth = 0;

let currentCoho:    Cohomology;
let currentBlocks:  ScaledBlocks;
let currentBasis:   readonly Vec6[];
let currentV:       Vec6;
let currentExample: SL4RExample;
let currentAction:  GroupAction;
let currentBasepoint: Float64Array;
let currentOrbit:   Orbit;
let currentProj:    ChartEmbedding;
let currentMesh: THREE.Mesh | null = null;

let depth = DEFAULT_DEPTH;
let renderMode: JMRenderMode = 'points';
let fabiT = FABI_DEFAULT_T;
let fabiScale = FABI_DEFAULT_SCALE;
let stats = { kept: 0, totalWords: 0 };

// ─── Recompute pipeline ────────────────────────────────────────────────────

function recomputeBasis(): void {
  // (kA, kB) = (ℓ(a), 0), read off the fixed SO(2,1) matrix A. φ = s·k.
  const m = defaultMultipliers(rep);
  kA = m.kA;
  kB = m.kB;
  currentCoho = makeCohomology(kA, kB, sCoh);
  currentBlocks = scaledBlocks(rep, currentCoho);
  const space = cocycleSpace(currentBlocks.A, currentBlocks.B);
  currentBasis = space.basis;
}

function rebuildGenerators(): void {
  currentV = combineBasis(currentBasis, alphas);
  currentExample = buildExample(rep, currentCoho, currentV, currentBlocks);
  currentAction  = makeMat4Action(currentExample.generators, { involutions: false });
  const r = computeProximalBasepoint(
    currentAction, currentExample.gamma, currentExample.powerIter);
  currentBasepoint = r.basepoint;
}

function regenerateOrbit(N: number): void {
  currentOrbit = generateOrbit(currentAction, currentBasepoint, N);
}

function rebuildMesh(autofit: boolean): void {
  const scheme = schemeForColorDepth(colorDepth);
  const palette = paletteForScheme(scheme.name);
  const { aPos, aColor, kept } = buildOrbitInstances(
    currentProj, currentOrbit, scheme, palette,
  );
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

function rebuildFabiChart(): void {
  const c = makeFabiChart(fabiT, fabiScale);
  currentProj = makeChartFromData({
    stateDim: 4,
    denom: [...c.denom],
    rows: [[...c.rowX], [...c.rowY], [...c.rowZ]],
    label: c.id,
    pretty: c.pretty ?? c.label,
  });
}

/** Full pipeline: φ → cocycle basis → v → SL4Rexample → orbit → mesh. */
function repipeline(autofit: boolean): void {
  recomputeBasis();
  rebuildGenerators();
  regenerateOrbit(depth);
  rebuildMesh(autofit);
  updateUI();
}

/** Light pipeline: only the α coords changed; basis is reused. */
function alphaRetrigger(): void {
  rebuildGenerators();
  regenerateOrbit(depth);
  rebuildMesh(false);
  updateUI();
}

// When the cocycle basis changes (φ / s), reset α to (0, 0, 0) — the trivial
// cocycle v = 0, basis-independent. Without this reset, the same numerical α
// refers silently to a different v after the basis changes.
function resetAlphasToZero(): void {
  alphas = [0, 0, 0];
  slA1.set(0); slA2.set(0); slA3.set(0);
}

// ─── HUD ────────────────────────────────────────────────────────────────────

const panel = new ControlPanel({ title: 'James–Marit (new) — fixed SO(2,1) rep, SL(4,R) limit sets in RP³' });

// Always-visible status. Stays above the collapsible folders so you can
// see #words / kept / view label regardless of what's open.
const modeEl  = panel.text({ variant: 'mode' });
const statsEl = panel.text({ variant: 'stats' });

// ── Cocycle (α coords) — primary interaction, open by default ─────────────
const cocyFolder = panel.folder('Cocycle (α coords)', { open: true });
const slA1 = cocyFolder.slider({
  label: 'α₁',
  min: -50, max: 50, step: 0.001, value: alphas[0],
  format: (v) => v.toFixed(3),
  onChange: (v) => { alphas = [v, alphas[1], alphas[2]]; alphaRetrigger(); },
});
const slA2 = cocyFolder.slider({
  label: 'α₂',
  min: -50, max: 50, step: 0.001, value: alphas[1],
  format: (v) => v.toFixed(3),
  onChange: (v) => { alphas = [alphas[0], v, alphas[2]]; alphaRetrigger(); },
});
const slA3 = cocyFolder.slider({
  label: 'α₃',
  min: -50, max: 50, step: 0.001, value: alphas[2],
  format: (v) => v.toFixed(3),
  onChange: (v) => { alphas = [alphas[0], alphas[1], v]; alphaRetrigger(); },
});
const cocyMeta = cocyFolder.text({ variant: 'meta' });

// ── Cohomology (s) — k_a = ℓ(a), k_b = 0; χ = exp(−φ) ─────────────────────
const cohFolder = panel.folder('Cohomology (s)');
cohFolder.slider({
  label: 's (cohom scale)',
  min: 0, max: 1, step: 0.001, value: sCoh,
  format: (v) => v.toFixed(3),
  onChange: (v) => { sCoh = v; resetAlphasToZero(); repipeline(false); },
});
const cohMeta = cohFolder.text({ variant: 'meta' });

// ── Chart (Fabi projection) ────────────────────────────────────────────────
const chartFolder = panel.folder('Chart (Fabi projection)');
chartFolder.slider({
  label: 'Fabi t',
  min: -200, max: 200, step: 0.01, value: fabiT,
  format: (v) => v.toFixed(2),
  event: 'input',
  onChange: (v) => { fabiT = v; rebuildFabiChart(); rebuildMesh(false); updateUI(); },
});
chartFolder.slider({
  label: 'Fabi scale',
  min: 1, max: 600, step: 1, value: fabiScale,
  format: (v) => v.toFixed(0),
  event: 'input',
  onChange: (v) => { fabiScale = v; rebuildFabiChart(); rebuildMesh(false); updateUI(); },
});

// ── View (depth / camera) ──────────────────────────────────────────────────
const viewFolder = panel.folder('View');
viewFolder.slider({
  label: 'depth N',
  min: 4, max: 14, step: 1, value: depth,
  onChange: (v) => { depth = v; regenerateOrbit(v); rebuildMesh(false); updateUI(); },
});
viewFolder.slider({
  label: 'ball radius',
  min: 0.001, max: 0.2, step: 0.001, value: DEFAULT_RADIUS,
  format: (v) => v.toFixed(3),
  event: 'input',
  onChange: (v) => { uniforms.uRadius.value = v; },
});
const DEFAULT_FOV = app.camera.fov;
viewFolder.slider({
  label: 'fov',
  min: 0.5, max: 90, step: 0.5, value: DEFAULT_FOV,
  format: (v) => `${v}°`,
  event: 'input',
  onChange: (v) => {
    app.camera.fov = v;
    app.camera.updateProjectionMatrix();
  },
});

// ── Offline render — deposit mode + copy view JSON for the offline script ───
// Affects the offline PNG render only (the live preview here always shows
// orbit points). Rays-to-e₄ are an invariant subset of the limit set when
// s = 1; at s ≠ 1 they're a decoration.
const offlineFolder = panel.folder('Offline render');
offlineFolder.select({
  label: 'render mode',
  options: [
    { value: 'points', label: 'points only' },
    { value: 'rays',   label: 'rays to e₄' },
    { value: 'both',   label: 'points + rays' },
  ],
  value: renderMode,
  onChange: (v) => { renderMode = v as JMRenderMode; },
});
offlineFolder.text({
  variant: 'meta',
  initial: 'affects the offline render only; live preview always shows points.',
});
offlineFolder.button({
  label: 'copy view JSON for offline render',
  onClick: exportView,
});
const exportStatus = offlineFolder.text({ variant: 'meta' });

// ─── UI helpers ────────────────────────────────────────────────────────────

function updateUI(): void {
  cohMeta.html(
    `kA = ${kA.toFixed(4)} (= ℓ(a))   kB = ${kB.toFixed(4)}<br>` +
    `φ(a) = s·kA = ${currentCoho.phiA.toFixed(4)}   χ_A = exp(−φ(a)) = ${Math.exp(-currentCoho.phiA).toFixed(4)}<br>` +
    `φ(b) = s·kB = ${currentCoho.phiB.toFixed(4)}   χ_B = exp(−φ(b)) = ${Math.exp(-currentCoho.phiB).toFixed(4)}`,
  );
  const fmt = (x: number): string => x.toFixed(4);
  // First 3 entries of the 4×4 commutator [A, B] = A·B·A⁻¹·B⁻¹ bottom row at
  // the current (φ, α). For a valid cocycle (v_[a,b] = 0) these are all 0 —
  // drift from zero tells you how well the cocycle constraint holds.
  const A4 = currentExample.generators[0] as Mat4R;
  const B4 = currentExample.generators[1] as Mat4R;
  const comm4 = mat4Mul(mat4Mul(mat4Mul(A4, B4), mat4Inverse(A4)), mat4Inverse(B4));
  const bottom = comm4[3];
  cocyMeta.html(
    `(a,b,c) = (${fmt(currentV[0])}, ${fmt(currentV[1])}, ${fmt(currentV[2])})<br>` +
    `(x,y,z) = (${fmt(currentV[3])}, ${fmt(currentV[4])}, ${fmt(currentV[5])})<br>` +
    `v_[A,B] (first 3) = (${bottom[0]}, ${bottom[1]}, ${bottom[2]})`,
  );
  statsEl.text(
    `${stats.totalWords.toLocaleString()} words, ` +
    `${stats.kept.toLocaleString()} drawn`,
  );
  modeEl.text(`view: ${currentProj.pretty}`);
}

// ─── View export ────────────────────────────────────────────────────────────

async function exportView(): Promise<void> {
  const cam = app.camera as THREE.PerspectiveCamera;
  const tgt = app.controls.target;
  const canvas = app.renderManager.renderer.domElement;
  const bundle: JMViewPreset = {
    exampleId:    'james-marit-new',
    previewDepth: depth,
    colorScheme:  schemeForColorDepth(colorDepth).name,
    renderMode,
    generators:   currentExample.generators.map(
      (m) => m.map((r) => [...r]) as unknown as Mat4Json,
    ),
    gamma:        [...currentExample.gamma],
    gammaName:    currentExample.gammaName,
    powerIter:    currentExample.powerIter,
    involutions:  currentExample.involutions,
    params: {
      s: sCoh,
      alphas: [alphas[0], alphas[1], alphas[2]],
    },
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
  console.log('[james-marit-new-render] view JSON:\n' + json);

  let saved = false;
  try {
    const r = await fetch('/__save-view/james-marit-new', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: json,
    });
    if (r.ok) {
      saved = true;
      exportStatus.flash(
        'saved to scripts/james-marit-new-view-preset.json',
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

// HUD is fully constructed now — kick off the pipeline.
rebuildFabiChart();
repipeline(true);

app.start();
