/**
 * O(5) hypergeometric — limit-set viewer (Bajpai–Nitsche, "Thin Monodromy in
 * O(5)"). Pick a group, depth, chart, color scheme; the orbit auto-fits.
 *
 * Render path mirrors the sp6 viewer: proximal-basepoint power iteration on
 * γ = TB → non-backtracking BFS over the {T, B, B⁻¹} free-product alphabet →
 * projective chart (affine patch + linear projection to R³) → instanced spheres.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { ControlPanel } from '@/app/ControlPanel';
import { createSphereMaterial, makeInstancedSpheres } from '@/app/instancedSpheres';
import { autofitCamera } from '@/app/autofit';

import { EXAMPLES, exampleById, type O5Example } from '@/o5/examples';
import { makeO5Action } from '@/o5/action';
import { loxodromicSeed } from '@/o5/seed';
import type { GroupAction } from '@/core/group';
import { generateOrbit, type Orbit } from '@/core/orbit';
import {
  type ChartEmbedding, fitPCAChartEmbedding, fitAutoChartEmbedding,
} from '@/core/chart';
import { schemeForColorDepth } from '@/render/colorScheme.ts';
import { buildOrbitInstances } from '@/render/orbitInstances.ts';
import { paletteForScheme } from '@/o5/palettes.ts';

const app = new App({ antialias: true });
app.scene.background = new THREE.Color(0xf2f2f2);

const { material, uniforms } = createSphereMaterial();

const DEFAULT_EXAMPLE_ID = 'r1-1';
const DEFAULT_DEPTH = 13;
const DEFAULT_RADIUS = 0.02;

// ─── State ────────────────────────────────────────────────────────────────────

let currentExample!:   O5Example;
let currentAction!:    GroupAction;
let currentBasepoint!: Float64Array;
let currentLambda = NaN;
let currentGamma = 'TB';
let currentOrbit!:     Orbit;
let currentProj!:      ChartEmbedding;
let currentMesh: THREE.Mesh | null = null;
let depth = DEFAULT_DEPTH;
let colorDepth = 0;
let stats = { kept: 0, totalWords: 0 };

function loadExample(id: string): void {
  currentExample = exampleById(id);
  currentAction = makeO5Action(currentExample.coefflistf, currentExample.coefflistg);
  const s = loxodromicSeed(currentAction);
  currentBasepoint = s.basepoint;
  currentLambda = s.lambdaMax;
  currentGamma = s.name;
  console.log(
    `[o5-${currentExample.id}] ${currentExample.label} (${currentExample.type}): ` +
    `γ = ${s.name}${s.fallback ? ' (parabolic fallback)' : ''}, |λ_max| ≈ ${s.lambdaMax.toFixed(4)}, drift = ${s.drift.toFixed(6)}`,
  );
}

function regenerateOrbit(N: number): void {
  const t0 = performance.now();
  currentOrbit = generateOrbit(currentAction, currentBasepoint, N);
  console.log(
    `[o5-${currentExample.id}] BFS depth=${N}  words=${currentOrbit.count}  (${(performance.now() - t0).toFixed(0)}ms)`,
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

function applyChartSelection(value: string): void {
  currentProj = value === 'auto'
    ? fitAutoChartEmbedding(currentOrbit)
    : fitPCAChartEmbedding(currentOrbit, parseInt(value, 10));
}

// ─── Initial load ─────────────────────────────────────────────────────────────

loadExample(DEFAULT_EXAMPLE_ID);
regenerateOrbit(depth);
currentProj = fitAutoChartEmbedding(currentOrbit);
rebuildMesh(true);

// ─── HUD ────────────────────────────────────────────────────────────────────

const panel = new ControlPanel({ title: 'O(5) hypergeometric — limit sets' });

panel.text({ variant: 'meta' }).html(
  'Tables 1 &amp; 3 of Bajpai–Nitsche, <i>Thin Monodromy in O(5)</i>',
);

panel.select({
  label: 'example',
  options: EXAMPLES.map((e) => ({ value: e.id, label: `${e.label}` })),
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
  onChange: (v) => { depth = v; regenerateOrbit(v); rebuildMesh(false); updateUI(); },
});

panel.slider({
  label: 'ball radius',
  min: 0.001, max: 0.06, step: 0.0005, value: DEFAULT_RADIUS,
  format: (v) => v.toFixed(3), event: 'input',
  onChange: (v) => { uniforms.uRadius.value = v; },
});

const DEFAULT_FOV = app.camera.fov;
const slFov = panel.slider({
  label: 'fov',
  min: 0.5, max: 90, step: 0.5, value: DEFAULT_FOV,
  format: (v) => `${v}°`, event: 'input',
  onChange: (v) => { app.camera.fov = v; app.camera.updateProjectionMatrix(); },
});

panel.separator();

const selChart = panel.select({
  label: 'chart',
  options: [
    { value: 'auto', label: 'auto-chart (overall PCA)' },
    { value: '0', label: 'v₁ chart (PCA axes)' },
    { value: '1', label: 'v₂ chart (PCA axes)' },
    { value: '2', label: 'v₃ chart (PCA axes)' },
    { value: '3', label: 'v₄ chart (PCA axes)' },
    { value: '4', label: 'v₅ chart (PCA axes)' },
  ],
  value: 'auto',
  onChange: (v) => { applyChartSelection(v); rebuildMesh(true); updateUI(); },
});

panel.select({
  label: 'color by',
  options: [
    { value: '0', label: 'grayscale' },
    { value: '1', label: 'last letter' },
    { value: '2', label: '2nd-to-last letter' },
    { value: '3', label: '3rd-to-last letter' },
  ],
  value: '0',
  onChange: (v) => { colorDepth = parseInt(v, 10); rebuildMesh(false); updateUI(); },
});

panel.button({
  label: 'reset view',
  onClick: () => {
    depth = DEFAULT_DEPTH;
    slDepth.set(DEFAULT_DEPTH);
    selChart.set('auto');
    slFov.set(DEFAULT_FOV);
    app.camera.fov = DEFAULT_FOV; app.camera.updateProjectionMatrix();
    regenerateOrbit(depth);
    applyChartSelection('auto');
    rebuildMesh(true);
    updateUI();
  },
});

panel.separator();

const statsEl = panel.text({ variant: 'stats' });

panel.button({
  label: 'screenshot',
  onClick: () => app.screenshot(
    `o5-${currentExample.id}_${currentProj.label}_${stats.kept}pts_${shotTimestamp()}.png`,
  ),
});

function shotTimestamp(): string {
  return new Date().toISOString().replace(/[-:]|\..*/g, '').replace('T', '-');
}

function updateUI(): void {
  statsEl.text(`${stats.totalWords.toLocaleString()} words, ${stats.kept.toLocaleString()} drawn`);
  exMeta.html(
    `${currentExample.label} — <b>${currentExample.type}</b><br>` +
    `α = (${currentExample.alpha.join(', ')})<br>` +
    `β = (${currentExample.beta.join(', ')})<br>` +
    `B order: ${currentExample.bInfinite ? 'infinite' : 'finite'} · ` +
    `γ = ${currentGamma}, |λ_max| ≈ ${currentLambda.toFixed(3)}`,
  );
}

updateUI();
app.start();
