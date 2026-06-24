/**
 * James–Marit — SL(4,ℝ) limit sets in RP³, from a fixed SO(2,1) rep.
 *
 * The 4×4 rep is an affine cohomological deformation of a once-punctured-torus
 * rep (all the construction math lives in examples/james-marit):
 *   1. ρ : F₂ → SO(2,1) ⊂ SL(3,ℝ)   — fixed matrices (so21Rep)
 *   2. φ : F₂ → ℝ                    — χ = exp(−φ); φ(a) = s·ℓ(a), φ(b) = 0
 *   3. v : F₂ → ℝ³ cocycle           — in ker(v_{[a,b]} = 0); 3 α-sliders move
 *                                       within the (generically 3-dim) space
 *   gen(g) = [ exp(−φ(g))·ρ(g)  0 ; v(g)  1 ]
 *
 * Fabi's affine chart (t, scale) projects RP³ → R³ for display; γ = B seeds.
 * This demo is thin wiring — recompute cocycle basis on (s) change, rebuild
 * generators on (α) change.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { ControlPanel } from '@/app/ControlPanel';
import { createSphereMaterial, makeInstancedSpheres } from '@/app/instancedSpheres';
import { autofitCamera } from '@/app/autofit';
import { cameraSpecFromApp, viewportFromApp, saveViewPreset } from '@/app/viewExport';

import type { GroupAction } from '@/core/group';
import { generateOrbit, type Orbit } from '@/core/orbit';
import { type ChartEmbedding } from '@/core/chart';
import { makeMatrixAction, pairWithInverses } from '@/core/matrixAction';
import type { Mat } from '@/core/matrix';
import { schemeForColorDepth } from '@/render/colorScheme';
import { buildOrbitInstances } from '@/render/orbitInstances';

import { DEFAULT_REP, defaultMultipliers } from '@/examples/james-marit/so21Rep';
import { makeCohomology, DEFAULT_S } from '@/examples/james-marit/cohomology';
import {
  cocycleSpace, combineBasis, commutatorBottomRowNorm, type Vec6,
} from '@/examples/james-marit/cocycle';
import {
  scaledBlocks, jamesMaritGenerators, seedJamesMarit, JAMES_MARIT_SEED, type ScaledBlocks,
} from '@/examples/james-marit/recipe';
import { makeFabiChart, FABI_DEFAULT_T, FABI_DEFAULT_SCALE } from '@/examples/james-marit/fabiChart';
import { paletteForScheme } from '@/examples/james-marit/palette';
import type { JMViewPreset, JMRenderMode, Mat4Json } from './viewPreset';

const app = new App({ antialias: true });
app.scene.background = new THREE.Color(0xffffff);

const DEFAULT_RADIUS = 0.06;
const { material, uniforms } = createSphereMaterial(DEFAULT_RADIUS);
const DEFAULT_DEPTH = 8; // lower than catalog demos — we regen on every slider tick

// ─── State ──────────────────────────────────────────────────────────────────

const rep = DEFAULT_REP;
const { kA, kB } = defaultMultipliers(rep);   // (ℓ(a), 0), fixed for the fixed rep
let sCoh = DEFAULT_S;
let alphas: [number, number, number] = [0, 0, 0];

let blocks!: ScaledBlocks;
let basis: readonly Vec6[] = [];
let rank = 0;
let currentV: Vec6 = [0, 0, 0, 0, 0, 0];
let currentGenerators: [Mat, Mat] = [new Float64Array(16), new Float64Array(16)];
let action!: GroupAction;
let basepoint!: Float64Array;
let seedName = 'B';
let lambdaMax = NaN, drift = NaN, cocycleResidual = NaN;
let orbit!: Orbit;
let proj!: ChartEmbedding;
let mesh: THREE.Mesh | null = null;

let depth = DEFAULT_DEPTH;
const colorDepth = 0;
let renderMode: JMRenderMode = 'points';
let fabiT = FABI_DEFAULT_T;
let fabiScale = FABI_DEFAULT_SCALE;
let stats = { kept: 0, totalWords: 0 };

// ─── Pipeline ────────────────────────────────────────────────────────────────

/** s changed → recompute the scaled blocks and the cocycle basis. */
function recomputeBasis(): void {
  const coho = makeCohomology(kA, kB, sCoh);
  blocks = scaledBlocks(rep, coho);
  const space = cocycleSpace(blocks.A, blocks.B);
  basis = space.basis;
  rank = space.rank;
}

/** α (or basis) changed → rebuild generators, action, basepoint. */
function rebuildGenerators(): void {
  currentV = combineBasis(basis, alphas);
  currentGenerators = jamesMaritGenerators(blocks, currentV);
  action = makeMatrixAction(pairWithInverses(currentGenerators));
  const s = seedJamesMarit(action);
  basepoint = s.basepoint;
  seedName = s.name;
  lambdaMax = s.lambdaMax;
  drift = s.drift;
  cocycleResidual = commutatorBottomRowNorm(blocks.A, blocks.B, currentV);
}

function regenerateOrbit(N: number): void {
  orbit = generateOrbit(action, basepoint, N);
}

function rebuildFabiChart(): void {
  proj = makeFabiChart(fabiT, fabiScale);
}

function rebuildMesh(autofit: boolean): void {
  const scheme = schemeForColorDepth(colorDepth);
  const palette = paletteForScheme(scheme.name);
  const { aPos, aColor, kept } = buildOrbitInstances(proj, orbit, scheme, palette);
  const next = makeInstancedSpheres(material, aPos, aColor);
  if (mesh) { app.scene.remove(mesh); mesh.geometry.dispose(); }
  app.scene.add(next);
  mesh = next;
  if (autofit) autofitCamera(app, aPos, kept);
  stats = { kept, totalWords: orbit.count };
}

/** Full rebuild on s change. */
function repipeline(autofit: boolean): void {
  recomputeBasis();
  rebuildGenerators();
  regenerateOrbit(depth);
  rebuildMesh(autofit);
  updateUI();
}

/** Light rebuild on α change (basis reused). */
function alphaRetrigger(): void {
  rebuildGenerators();
  regenerateOrbit(depth);
  rebuildMesh(false);
  updateUI();
}

/** Reset α to (0,0,0) — the trivial cocycle v = 0 — whenever the basis changes,
 *  so a numeric α doesn't silently mean a different v after the basis moves. */
function resetAlphasToZero(): void {
  alphas = [0, 0, 0];
  slA1.set(0); slA2.set(0); slA3.set(0);
}

// ─── HUD ────────────────────────────────────────────────────────────────────

const panel = new ControlPanel({ title: 'James–Marit — SL(4,ℝ) limit sets (fixed SO(2,1) rep)' });
const modeEl  = panel.text({ variant: 'mode' });
const statsEl = panel.text({ variant: 'stats' });

const cocyFolder = panel.folder('Cocycle (α coords)', { open: true });
const slA1 = cocyFolder.slider({ label: 'α₁', min: -50, max: 50, step: 0.001, value: alphas[0], format: (v) => v.toFixed(3), onChange: (v) => { alphas = [v, alphas[1], alphas[2]]; alphaRetrigger(); } });
const slA2 = cocyFolder.slider({ label: 'α₂', min: -50, max: 50, step: 0.001, value: alphas[1], format: (v) => v.toFixed(3), onChange: (v) => { alphas = [alphas[0], v, alphas[2]]; alphaRetrigger(); } });
const slA3 = cocyFolder.slider({ label: 'α₃', min: -50, max: 50, step: 0.001, value: alphas[2], format: (v) => v.toFixed(3), onChange: (v) => { alphas = [alphas[0], alphas[1], v]; alphaRetrigger(); } });
const cocyMeta = cocyFolder.text({ variant: 'meta' });

const cohFolder = panel.folder('Cohomology (s)');
cohFolder.slider({ label: 's (cohom scale)', min: 0, max: 1, step: 0.001, value: sCoh, format: (v) => v.toFixed(3), onChange: (v) => { sCoh = v; resetAlphasToZero(); repipeline(false); } });
const cohMeta = cohFolder.text({ variant: 'meta' });

const chartFolder = panel.folder('Chart (Fabi projection)');
chartFolder.slider({ label: 'Fabi t', min: -200, max: 200, step: 0.01, value: fabiT, format: (v) => v.toFixed(2), event: 'input', onChange: (v) => { fabiT = v; rebuildFabiChart(); rebuildMesh(false); updateUI(); } });
chartFolder.slider({ label: 'Fabi scale', min: 1, max: 600, step: 1, value: fabiScale, format: (v) => v.toFixed(0), event: 'input', onChange: (v) => { fabiScale = v; rebuildFabiChart(); rebuildMesh(false); updateUI(); } });

const viewFolder = panel.folder('View');
const slDepth = viewFolder.slider({ label: 'depth N', min: 4, max: 14, step: 1, value: depth, onChange: (v) => { depth = v; regenerateOrbit(v); rebuildMesh(false); updateUI(); } });
viewFolder.slider({ label: 'ball radius', min: 0.001, max: 0.2, step: 0.001, value: DEFAULT_RADIUS, format: (v) => v.toFixed(3), event: 'input', onChange: (v) => { uniforms.uRadius.value = v; } });
const DEFAULT_FOV = app.camera.fov;
const slFov = viewFolder.slider({ label: 'fov', min: 0.5, max: 90, step: 0.5, value: DEFAULT_FOV, format: (v) => `${v}°`, event: 'input', onChange: (v) => { app.camera.fov = v; app.camera.updateProjectionMatrix(); } });

const offlineFolder = panel.folder('Offline render');
offlineFolder.select({ label: 'render mode', options: [{ value: 'points', label: 'points only' }, { value: 'rays', label: 'rays to e₄' }, { value: 'both', label: 'points + rays' }], value: renderMode, onChange: (v) => { renderMode = v as JMRenderMode; } });
offlineFolder.button({ label: 'copy view JSON for offline render', onClick: exportView });
const exportStatus = offlineFolder.text({ variant: 'meta' });

const actionsFolder = panel.folder('Actions');
actionsFolder.button({
  label: 'reset',
  onClick: () => {
    sCoh = DEFAULT_S; resetAlphasToZero();
    fabiT = FABI_DEFAULT_T; fabiScale = FABI_DEFAULT_SCALE;
    depth = DEFAULT_DEPTH; slDepth.set(DEFAULT_DEPTH);
    slFov.set(DEFAULT_FOV); app.camera.fov = DEFAULT_FOV; app.camera.updateProjectionMatrix();
    rebuildFabiChart(); repipeline(true);
  },
});
actionsFolder.button({ label: 'screenshot', onClick: () => app.screenshot(`james-marit_${stats.kept}pts_${shotTimestamp()}.png`) });

// ─── UI ────────────────────────────────────────────────────────────────────

function shotTimestamp(): string {
  return new Date().toISOString().replace(/[-:]|\..*/g, '').replace('T', '-');
}

function updateUI(): void {
  const f = (x: number): string => x.toFixed(4);
  const coho = makeCohomology(kA, kB, sCoh);
  cohMeta.html(
    `kA = ${f(kA)} (= ℓ(a))   kB = ${f(kB)}<br>` +
    `φ(a) = s·kA = ${f(coho.phiA)}   χ_A = exp(−φ(a)) = ${f(Math.exp(-coho.phiA))}<br>` +
    `φ(b) = s·kB = ${f(coho.phiB)}   χ_B = ${f(Math.exp(-coho.phiB))}`,
  );
  cocyMeta.html(
    `cocycle rank: ${rank} (nullity ${basis.length})<br>` +
    `(a,b,c) = (${f(currentV[0])}, ${f(currentV[1])}, ${f(currentV[2])})<br>` +
    `(x,y,z) = (${f(currentV[3])}, ${f(currentV[4])}, ${f(currentV[5])})<br>` +
    `‖v_[A,B]‖ = ${cocycleResidual.toExponential(2)} (0 ⇒ valid cocycle)<br>` +
    `γ = ${seedName}, |λ_max| = ${lambdaMax.toFixed(3)}, drift = ${drift.toExponential(2)}`,
  );
  statsEl.text(`${stats.totalWords.toLocaleString()} words, ${stats.kept.toLocaleString()} drawn`);
  modeEl.text(`view: ${proj.pretty}`);
}

// ─── View export ─────────────────────────────────────────────────────────────

async function exportView(): Promise<void> {
  const toJson = (m: Mat): Mat4Json =>
    [[m[0], m[1], m[2], m[3]], [m[4], m[5], m[6], m[7]], [m[8], m[9], m[10], m[11]], [m[12], m[13], m[14], m[15]]] as unknown as Mat4Json;
  const bundle: JMViewPreset = {
    exampleId: 'james-marit-new',
    previewDepth: depth,
    colorScheme: schemeForColorDepth(colorDepth).name,
    renderMode,
    generators: currentGenerators.map(toJson),
    gamma: [...JAMES_MARIT_SEED],
    gammaName: 'B',
    powerIter: 200,
    involutions: false,
    params: { s: sCoh, alphas: [alphas[0], alphas[1], alphas[2]] },
    projection: {
      denom: Array.from(proj.denom),
      rowX: Array.from(proj.rows[0]),
      rowY: Array.from(proj.rows[1]),
      rowZ: Array.from(proj.rows[2]),
      label: proj.label,
    },
    camera: cameraSpecFromApp(app),
    viewport: viewportFromApp(app),
  };
  await saveViewPreset('james-marit-new', bundle, (msg, ok) =>
    exportStatus.flash(msg, 2500, ok ? '#9ec79e' : '#d9a55c'));
}

// ─── Kick off ────────────────────────────────────────────────────────────────

rebuildFabiChart();
repipeline(true);
app.start();
