/**
 * O(5) hypergeometric explorer — browse the full Bajpai–Nitsche catalog of
 * degree-5 orthogonal hypergeometric groups ("Thin Monodromy in O(5)",
 * Tables 1–4), filtered by family.
 *
 * Data: `@/o5/catalog` (CATALOG_EXAMPLES) — 29 groups: 12 thin + 7 open of type
 * O(3,2), 9 thin + 1 open of type O(4,1). Render path is identical to the
 * o5-limit-sets viewer: proximal-basepoint power iteration on γ = TB →
 * non-backtracking BFS over the {T, B, B⁻¹} free-product alphabet → projective
 * chart → instanced spheres. Validation is lazy (per selection).
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { ControlPanel } from '@/app/ControlPanel';
import { createSphereMaterial, makeInstancedSpheres } from '@/app/instancedSpheres';
import { autofitCamera } from '@/app/autofit';

import { CATALOG_EXAMPLES } from '@/o5/catalog';
import type { O5Example } from '@/o5/examples';
import { validateExample } from '@/o5/validate';
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

type Family = 'all' | 'thin' | 'open';
const DEFAULT_FAMILY: Family = 'all';
const DEFAULT_EXAMPLE_ID = 'o41-1';
const DEFAULT_DEPTH = 13;
const DEFAULT_RADIUS = 0.02;

// ─── State ────────────────────────────────────────────────────────────────────

const byId = new Map(CATALOG_EXAMPLES.map((e) => [e.id, e]));

let family: Family = DEFAULT_FAMILY;
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

function groupsInFamily(f: Family): O5Example[] {
  return f === 'all' ? [...CATALOG_EXAMPLES] : CATALOG_EXAMPLES.filter((e) => e.nature === f);
}

function loadExample(id: string): void {
  const ex = byId.get(id);
  if (!ex) throw new Error(`unknown o5 catalog group id: ${id}`);
  currentExample = ex;
  currentAction = makeO5Action(ex.coefflistf, ex.coefflistg);

  const v = validateExample(ex);
  for (const w of v.warnings) console.warn(`[o5-explorer ${ex.label}] ⚠ ${w}`);
  if (!v.passed) console.error(`[o5-explorer ${ex.label}] ✗ ${v.errors.join('; ')}`);

  const s = loxodromicSeed(currentAction);
  currentBasepoint = s.basepoint;
  currentLambda = s.lambdaMax;
  currentGamma = s.name;
  console.log(
    `[o5-explorer ${ex.label}] loaded (${ex.type}, ${ex.nature}): γ = ${s.name}${s.fallback ? ' (parabolic fallback)' : ''}, |λ_max| ≈ ${s.lambdaMax.toFixed(4)}, drift = ${s.drift.toFixed(6)}`,
  );
}

function regenerateOrbit(N: number): void {
  const t0 = performance.now();
  currentOrbit = generateOrbit(currentAction, currentBasepoint, N);
  console.log(`[o5-explorer ${currentExample.label}] BFS depth=${N}  words=${currentOrbit.count}  (${(performance.now() - t0).toFixed(0)}ms)`);
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

function selectGroup(id: string): void {
  loadExample(id);
  slDepth.set(DEFAULT_DEPTH);
  depth = DEFAULT_DEPTH;
  regenerateOrbit(depth);
  applyChartSelection(selChart.value);
  rebuildMesh(true);
  updateUI();
}

// ─── Initial load ─────────────────────────────────────────────────────────────

loadExample(DEFAULT_EXAMPLE_ID);
regenerateOrbit(depth);
currentProj = fitAutoChartEmbedding(currentOrbit);
rebuildMesh(true);

// ─── HUD ────────────────────────────────────────────────────────────────────

const panel = new ControlPanel({ title: 'O(5) hypergeometric explorer' });

panel.text({ variant: 'meta' }).html(
  'Tables 1–4 of Bajpai–Nitsche, <i>Thin Monodromy in O(5)</i>',
);

// ─── Group folder ─────────────────────────────────────────────────────────────
const groupFolder = panel.folder('Group', { open: true });

const familyLabel: Record<Family, string> = {
  all: 'all (29)', thin: 'thin (21)', open: 'open (8)',
};

groupFolder.select({
  label: 'family',
  options: (['all', 'thin', 'open'] as Family[]).map((f) => ({ value: f, label: familyLabel[f] })),
  value: family,
  onChange: (v) => {
    family = v as Family;
    populateGroups();
    selectGroup(selGroup.value);
  },
});

const selGroup = groupFolder.select({
  label: 'group',
  options: groupsInFamily(family).map(groupOption),
  value: DEFAULT_EXAMPLE_ID,
  onChange: (id) => selectGroup(id),
});

function groupOption(e: O5Example): { value: string; label: string } {
  return { value: e.id, label: family === 'all' ? `${e.label} — ${e.nature}` : e.label };
}

/** Which <optgroup> a row belongs to — by signature type. */
function typeHeader(e: O5Example): string {
  return e.type === 'O(3,2)'
    ? 'O(3,2) · real rank 2'
    : 'O(4,1) · real rank 1 (hyperbolic)';
}

function populateGroups(): void {
  const groups = groupsInFamily(family);
  const keep = groups.some((e) => e.id === selGroup.value) ? selGroup.value : groups[0].id;
  const el = selGroup.element;
  el.innerHTML = '';
  let header = '';
  let og: HTMLOptGroupElement | null = null;
  for (const e of groups) {
    const h = typeHeader(e);
    if (h !== header) {
      og = document.createElement('optgroup');
      og.label = h;
      el.appendChild(og);
      header = h;
    }
    const o = document.createElement('option');
    o.value = e.id;
    o.textContent = groupOption(e).label;
    og!.appendChild(o);
  }
  selGroup.set(keep);
}
populateGroups();

const exMeta = groupFolder.text({ variant: 'meta' });

// ─── View folder ──────────────────────────────────────────────────────────────
const viewFolder = panel.folder('View');

const selChart = viewFolder.select({
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

viewFolder.select({
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

const slDepth = viewFolder.slider({
  label: 'depth N',
  min: 4, max: 18, step: 1, value: depth,
  onChange: (v) => { depth = v; regenerateOrbit(v); rebuildMesh(false); updateUI(); },
});

viewFolder.slider({
  label: 'ball radius',
  min: 0.001, max: 0.06, step: 0.0005, value: DEFAULT_RADIUS,
  format: (v) => v.toFixed(3), event: 'input',
  onChange: (v) => { uniforms.uRadius.value = v; },
});

const DEFAULT_FOV = app.camera.fov;
const slFov = viewFolder.slider({
  label: 'fov',
  min: 0.5, max: 90, step: 0.5, value: DEFAULT_FOV,
  format: (v) => `${v}°`, event: 'input',
  onChange: (v) => { app.camera.fov = v; app.camera.updateProjectionMatrix(); },
});

viewFolder.button({
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
    `${currentExample.label} — <b>${currentExample.type}</b> · ${currentExample.nature}<br>` +
    `α = (${currentExample.alpha.join(', ')})<br>` +
    `β = (${currentExample.beta.join(', ')})<br>` +
    `B order: ${currentExample.bInfinite ? 'infinite' : 'finite'} · ` +
    `γ = ${currentGamma}, |λ_max| ≈ ${currentLambda.toFixed(3)}`,
  );
}

updateUI();
app.start();
