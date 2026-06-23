/**
 * Sp(6) hypergeometric explorer — browse the Bajpai–Doña–Nitsche catalog of
 * "companion matrix" groups (Tables 1–2 of arXiv:2112.12111), filtered by
 * thin / arithmetic family.
 *
 * Data: `@/sp6/catalog` (CATALOG_EXAMPLES) — 40 maximally-unipotent A-groups
 * (17 thin, 23 arithmetic) + 45 thin C-groups, each derived from its (α, β)
 * rotation numbers. The render path is identical to the sp6-limit-sets viewer:
 * proximal-basepoint power iteration → non-backtracking BFS orbit → projective
 * chart → instanced spheres. The only new UI is the two-level selection:
 *
 *   family  — thin | arithmetic | all   (repopulates the group dropdown)
 *   group   — every catalog group in the chosen family
 *
 * Validation is lazy: each group is validated on selection (not all 85 at
 * startup), warnings logged to the console.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { ControlPanel } from '@/app/ControlPanel';
import { createSphereMaterial, makeInstancedSpheres } from '@/app/instancedSpheres';
import { autofitCamera } from '@/app/autofit';

import { CATALOG_EXAMPLES } from '@/sp6/catalog';
import type { Sp6Example } from '@/sp6/examples';
import { validateExample } from '@/sp6/validate';
import { makeSp6Action } from '@/sp6/action';
import type { GroupAction } from '@/core/group';
import { computeProximalBasepoint, generateOrbit, type Orbit } from '@/core/orbit';
import {
  type ChartEmbedding, fitPCAChartEmbedding, fitAutoChartEmbedding,
} from '@/core/chart';
import { schemeForColorDepth } from '@/render/colorScheme.ts';
import { buildOrbitInstances } from '@/render/orbitInstances.ts';
import { paletteForScheme } from '@/sp6/palettes.ts';

const app = new App({ antialias: true });
app.scene.background = new THREE.Color(0xf2f2f2);

const { material, uniforms } = createSphereMaterial();

type Family = 'all' | 'thin' | 'arithmetic' | 'open';
const DEFAULT_FAMILY: Family = 'all';
const DEFAULT_EXAMPLE_ID = 'A1';
const DEFAULT_DEPTH = 12;
const DEFAULT_RADIUS = 0.025;

// ─── State ────────────────────────────────────────────────────────────────────

const byId = new Map(CATALOG_EXAMPLES.map((e) => [e.id, e]));

let family: Family = DEFAULT_FAMILY;
let currentExample!:   Sp6Example;
let currentAction!:    GroupAction;
let currentBasepoint!: Float64Array;
let currentLambda = NaN;
let currentOrbit!:     Orbit;
let currentProj!:      ChartEmbedding;
let currentMesh: THREE.Mesh | null = null;
let depth = DEFAULT_DEPTH;
let colorDepth = 0;
let stats = { kept: 0, totalWords: 0 };

/** Catalog groups in the active family, in catalog order. */
function groupsInFamily(f: Family): Sp6Example[] {
  return f === 'all' ? [...CATALOG_EXAMPLES] : CATALOG_EXAMPLES.filter((e) => e.status === f);
}

function loadExample(id: string): void {
  const ex = byId.get(id);
  if (!ex) throw new Error(`unknown catalog group id: ${id}`);
  currentExample = ex;
  currentAction = makeSp6Action(ex);

  // Lazy validation: structural + dynamical, on selection only. Warn, don't throw.
  const v = validateExample(ex);
  for (const w of v.warnings) console.warn(`[sp6-explorer ${ex.label}] ⚠ ${w}`);
  if (!v.passed) console.error(`[sp6-explorer ${ex.label}] ✗ ${v.errors.join('; ')}`);

  const r = computeProximalBasepoint(currentAction, ex.gamma, ex.powerIter);
  currentBasepoint = r.basepoint;
  currentLambda = r.lambdaMax;
  console.log(
    `[sp6-explorer ${ex.label}] loaded (${ex.status}): |λ_max(${ex.gammaName})| ≈ ${r.lambdaMax.toFixed(3)}, drift = ${r.drift.toFixed(4)}`,
  );
}

function regenerateOrbit(N: number): void {
  const t0 = performance.now();
  currentOrbit = generateOrbit(currentAction, currentBasepoint, N);
  console.log(
    `[sp6-explorer ${currentExample.label}] BFS depth=${N}  words=${currentOrbit.count}  (${(performance.now() - t0).toFixed(0)}ms)`,
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

/** Load → orbit → chart → mesh for a freshly selected group. */
function selectGroup(id: string): void {
  loadExample(id);
  slDepth.set(DEFAULT_DEPTH);
  depth = DEFAULT_DEPTH;
  regenerateOrbit(depth);
  applyChartSelection(selChart.value);
  rebuildMesh(true);
  updateUI();
}

// ─── Initial load ───────────────────────────────────────────────────────────

loadExample(DEFAULT_EXAMPLE_ID);
regenerateOrbit(depth);
currentProj = fitPCAChartEmbedding(currentOrbit, 0);
rebuildMesh(true);

// ─── HUD ──────────────────────────────────────────────────────────────────────

const panel = new ControlPanel({ title: 'Sp(6) hypergeometric explorer' });

// Source attribution — the groups are Tables 1–3 of the BDN paper.
panel.text({ variant: 'meta' }).html(
  'Tables 1–3 of Bajpai–Doña–Nitsche, ' +
  '<a href="https://arxiv.org/abs/2112.12111" target="_blank" rel="noopener" ' +
  'style="color:#9ec7ff">' +
  '<i>Thin monodromy in Sp(4) and Sp(6)</i></a>',
);

// ─── Group folder — which group: family filter → catalog dropdown + identity ──
const groupFolder = panel.folder('Group', { open: true });

const familyLabel: Record<Family, string> = {
  all: 'all (88)', thin: 'thin (62)', arithmetic: 'arithmetic (23)', open: 'open (3)',
};

groupFolder.select({
  label: 'family',
  options: (['all', 'thin', 'arithmetic', 'open'] as Family[]).map((f) => ({ value: f, label: familyLabel[f] })),
  value: family,
  onChange: (v) => {
    family = v as Family;
    populateGroups();             // repopulate + auto-select the first group
    selectGroup(selGroup.value);
  },
});

const selGroup = groupFolder.select({
  label: 'group',
  options: groupsInFamily(family).map(groupOption),
  value: DEFAULT_EXAMPLE_ID,
  onChange: (id) => selectGroup(id),
});

/** Dropdown label for a group: "A-1 — thin" in 'all', else just "A-1". */
function groupOption(e: Sp6Example): { value: string; label: string } {
  return { value: e.id, label: family === 'all' ? `${e.label} — ${e.status}` : e.label };
}

/** Which <optgroup> a row belongs to — by source table (paper structure). */
function tableHeader(e: Sp6Example): string {
  if (e.status === 'open') return 'Table 3 · open (unclassified)';
  return e.label.startsWith('A-')
    ? 'Table 1 · maximally unipotent (α = 0)'
    : 'Table 2 · more thin';
}

/** Rebuild the group dropdown for the current family, grouped into <optgroup>s
 *  by source table (the catalog is ordered A-rows then C-rows, so each table is
 *  one contiguous run). Keep the selection if it still belongs to the family,
 *  else fall back to the first group. */
function populateGroups(): void {
  const groups = groupsInFamily(family);
  const keep = groups.some((e) => e.id === selGroup.value) ? selGroup.value : groups[0].id;
  const el = selGroup.element;
  el.innerHTML = '';
  let header = '';
  let og: HTMLOptGroupElement | null = null;
  for (const e of groups) {
    const h = tableHeader(e);
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
populateGroups();   // replace the flat initial options with table-grouped ones

const exMeta = groupFolder.text({ variant: 'meta' });

// ─── View folder — how the fixed orbit is projected, colored, and framed ──────
const viewFolder = panel.folder('View');

const selChart = viewFolder.select({
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
  onChange: (v) => { applyChartSelection(v); rebuildMesh(true); updateUI(); },
});

viewFolder.select({
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

const slDepth = viewFolder.slider({
  label: 'depth N',
  min: 4, max: 13, step: 1, value: depth,
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
    selChart.set('0');
    slFov.set(DEFAULT_FOV);
    app.camera.fov = DEFAULT_FOV; app.camera.updateProjectionMatrix();
    regenerateOrbit(depth);
    applyChartSelection('0');
    rebuildMesh(true);
    updateUI();
  },
});

panel.separator();

const statsEl = panel.text({ variant: 'stats' });

panel.button({
  label: 'screenshot',
  onClick: () => app.screenshot(
    `sp6-${currentExample.label}_${currentProj.label}_${stats.kept}pts_${shotTimestamp()}.png`,
  ),
});

function shotTimestamp(): string {
  return new Date().toISOString().replace(/[-:]|\..*/g, '').replace('T', '-');
}

function updateUI(): void {
  statsEl.text(`${stats.totalWords.toLocaleString()} words, ${stats.kept.toLocaleString()} drawn`);
  exMeta.html(
    `${currentExample.label} — <b>${currentExample.status}</b><br>` +
    `α = ${currentExample.alpha}<br>` +
    `β = ${currentExample.beta}<br>` +
    `γ = ${currentExample.gammaName}, |λ_max| ≈ ${currentLambda.toFixed(3)}`,
  );
}

updateUI();
app.start();
