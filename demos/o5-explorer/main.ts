/**
 * O(5) hypergeometric atlas — browse the full degree-5 orthogonal classification
 * (Bajpai–Singh, arXiv:1706.08791): all 77 monodromy groups, numbered 1–77,
 * filtered by status (thin / arithmetic / open / finite).
 *
 * Data: `@/o5/catalog` (CATALOG_EXAMPLES) — 28 thin + 37 arithmetic + 8 open +
 * 4 finite. Thin groups give fractal limit sets; arithmetic groups are lattices
 * (dense orbit closure); finite groups have no limit set. Render path: auto-found
 * loxodromic seed (`@/o5/seed`) → non-backtracking BFS over the {T, B, B⁻¹}
 * free-product alphabet → projective chart → instanced spheres. Validation is
 * lazy (per selection). The "save framing for render" button exports the framed
 * perspective view for scripts/o5-render-limit-set.ts. The sole O(5) demo.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { ControlPanel } from '@/app/ControlPanel';
import { createSphereMaterial } from '@/app/instancedSpheres';
import { buildLimitSetMesh } from '@/app/limitSetMesh';
import { cameraSpecFromApp, viewportFromApp, saveViewPreset } from '@/app/viewExport';

import { CATALOG_EXAMPLES } from '@/o5/catalog';
import type { O5Example } from '@/o5/types';
import { validateExample } from '@/o5/validate';
import { makeO5Action } from '@/o5/action';
import { loxodromicSeed } from '@/o5/seed';
import type { GroupAction } from '@/core/group';
import { generateOrbit, type Orbit } from '@/core/orbit';
import {
  type ChartEmbedding, fitPCAChartEmbedding, fitAutoChartEmbedding,
} from '@/core/chart';
import { schemeForColorDepth } from '@/render/colorScheme.ts';
import { paletteForScheme } from '@/o5/palettes.ts';
import type { ViewPreset } from '@/o5/viewPreset';

const app = new App({ antialias: true });
app.scene.background = new THREE.Color(0xf2f2f2);

const { material, uniforms } = createSphereMaterial();

// Top-level grouping is by PAPER (the three source papers), then (within the
// dropdown) by thin/arith/open. The finer "who first proved it arithmetic"
// credit (Venkataramana / Singh / Bajpai–Singh–Singh — all cited by Bajpai–Singh)
// stays in each group's `source`, shown in the panel, not as a dropdown category.
const PAPERS = ['Bajpai–Nitsche', 'Fuchs–Meiri–Sarnak', 'Bajpai–Singh'] as const;
type Paper = 'all' | (typeof PAPERS)[number];
const DEFAULT_PAPER: Paper = 'Bajpai–Nitsche'; // the collaborators' "Thin Monodromy in O(5)"
const DEFAULT_EXAMPLE_ID = 'g48';  // No. 48 = "O(3,2) Case 1" — first thin O(3,2)
const DEFAULT_DEPTH = 13;
const DEFAULT_RADIUS = 0.02;

const STATUS_ORDER: Record<string, number> = { thin: 0, arithmetic: 1, open: 2, finite: 3 };

/** Which of the three uploaded papers a group comes from: the 29 in "Thin
 *  Monodromy in O(5)" (those carry a bdnLabel — thin + open), the 7 thin O(4,1)
 *  proven by Fuchs–Meiri–Sarnak, and everything else (all 37 arithmetic + 4
 *  finite) tabulated in Bajpai–Singh. */
function paperOf(e: O5Example): string {
  if (e.bdnLabel) return 'Bajpai–Nitsche';
  if (e.source === 'Fuchs–Meiri–Sarnak') return 'Fuchs–Meiri–Sarnak';
  return 'Bajpai–Singh';
}

// ─── State ────────────────────────────────────────────────────────────────────

const byId = new Map(CATALOG_EXAMPLES.map((e) => [e.id, e]));

let paper: Paper = DEFAULT_PAPER;
let currentExample!:   O5Example;
let currentAction!:    GroupAction;
let currentBasepoint!: Float64Array;
let currentLambda = NaN;
let currentGamma = 'TB';
/** False when the loxodromic seed search failed (finite groups, or any group we
 *  haven't yet found a loxodromic for). We then draw nothing rather than show a
 *  misleading picture from an arbitrary fallback point. */
let currentSeedFound = true;
let currentOrbit!:     Orbit;
let currentProj!:      ChartEmbedding;
let currentMesh: THREE.Mesh | null = null;
let depth = DEFAULT_DEPTH;
let colorDepth = 0;
let stats = { kept: 0, totalWords: 0 };

/** Groups in a paper (or all), ordered so the dropdown's <optgroup>s are
 *  contiguous: by status within a paper, by paper order when browsing all. */
function groupsInPaper(p: Paper): O5Example[] {
  const list = p === 'all'
    ? [...CATALOG_EXAMPLES]
    : CATALOG_EXAMPLES.filter((e) => paperOf(e) === p);
  return list.sort((a, b) =>
    (p === 'all'
      ? PAPERS.indexOf(paperOf(a) as never) - PAPERS.indexOf(paperOf(b) as never)
      : STATUS_ORDER[a.status] - STATUS_ORDER[b.status]) || a.bsNo - b.bsNo);
}

function clearMesh(): void {
  if (currentMesh) {
    app.scene.remove(currentMesh);
    currentMesh.geometry.dispose();
    currentMesh = null;
  }
  stats = { kept: 0, totalWords: 0 };
}

function loadExample(id: string): void {
  const ex = byId.get(id);
  if (!ex) throw new Error(`unknown o5 catalog group id: ${id}`);
  currentExample = ex;
  currentAction = makeO5Action(ex.coefflistf, ex.coefflistg);

  const v = validateExample(ex);
  for (const w of v.warnings) console.warn(`[o5-explorer ${ex.label}] ⚠ ${w}`);
  if (!v.passed) console.error(`[o5-explorer ${ex.label}] ✗ ${v.errors.join('; ')}`);

  // Seed from a loxodromic word. If the search fails (finite groups, or any case
  // we haven't cracked yet), draw nothing and say so — never an arbitrary picture.
  const s = loxodromicSeed(currentAction);
  currentSeedFound = !s.fallback;
  currentBasepoint = s.basepoint;
  currentLambda = currentSeedFound ? s.lambdaMax : NaN;
  currentGamma = currentSeedFound ? s.name : '—';
  console.log(
    `[o5-explorer ${ex.label}] (${ex.type}, ${ex.status}): ` +
    (currentSeedFound
      ? `γ = ${s.name}, |λ_max| ≈ ${s.lambdaMax.toFixed(4)}, drift = ${s.drift.toFixed(6)}`
      : 'no loxodromic element found — nothing to draw'),
  );
}

function regenerateOrbit(N: number): void {
  if (!currentSeedFound) return;
  const t0 = performance.now();
  currentOrbit = generateOrbit(currentAction, currentBasepoint, N);
  console.log(`[o5-explorer ${currentExample.label}] BFS depth=${N}  words=${currentOrbit.count}  (${(performance.now() - t0).toFixed(0)}ms)`);
}

function rebuildMesh(autofit: boolean): void {
  if (!currentSeedFound) { clearMesh(); return; }
  const { mesh, kept } = buildLimitSetMesh({
    app, material, embedding: currentProj, orbit: currentOrbit,
    colorDepth, paletteForScheme, previous: currentMesh, autofit,
  });
  currentMesh = mesh;
  stats = { kept, totalWords: currentOrbit.count };
}

function applyChartSelection(value: string): void {
  if (!currentSeedFound) return;
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
  'The full degree-5 orthogonal classification — all 77 groups of ' +
  '<a href="https://arxiv.org/abs/1706.08791" target="_blank" rel="noopener" style="color:#9ec7ff">' +
  'Bajpai–Singh</a>, grouped by paper.',
);

// ─── Group folder ─────────────────────────────────────────────────────────────
const groupFolder = panel.folder('Group', { open: true });

const count = (p: Paper): number => groupsInPaper(p).length;

groupFolder.select({
  label: 'paper',
  options: (['all', ...PAPERS] as Paper[]).map((p) => ({
    value: p, label: `${p === 'all' ? 'all papers' : p} (${count(p)})`,
  })),
  value: paper,
  onChange: (v) => {
    paper = v as Paper;
    populateGroups();
    selectGroup(selGroup.value);
  },
});

const selGroup = groupFolder.select({
  label: 'group',
  options: groupsInPaper(paper).map(groupOption),
  value: DEFAULT_EXAMPLE_ID,
  onChange: (id) => selectGroup(id),
});

function groupOption(e: O5Example): { value: string; label: string } {
  // For groups in the Thin Monodromy paper, show that label (it already names
  // the type); otherwise the signature type. Append status only when browsing
  // all papers (then the <optgroup> is by paper, not status).
  const name = e.bdnLabel ?? e.type;
  return { value: e.id, label: `${e.label} — ${name}${paper === 'all' ? ` · ${e.status}` : ''}` };
}

/** Which <optgroup> a row belongs to: by status within a chosen paper, by paper
 *  when browsing all. */
function groupHeader(e: O5Example): string {
  if (paper === 'all') return paperOf(e);
  return { thin: 'thin', arithmetic: 'arithmetic',
           open: 'open', finite: 'finite (no limit set)' }[e.status];
}

function populateGroups(): void {
  const groups = groupsInPaper(paper);
  const keep = groups.some((e) => e.id === selGroup.value) ? selGroup.value : groups[0].id;
  const el = selGroup.element;
  el.innerHTML = '';
  let header = '';
  let og: HTMLOptGroupElement | null = null;
  for (const e of groups) {
    const h = groupHeader(e);
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

panel.separator();

panel.button({
  label: 'save framing for render',
  onClick: exportView,
});
const exportStatus = panel.text({ variant: 'meta' });

// ─── Export view for offline render ─────────────────────────────────────────
// Serialize the current camera + chart projection + group/depth to a ViewPreset
// the offline render reproduces. The shared camera/viewport/POST plumbing lives
// in @/app/viewExport; only the family-specific `projection` block is built here.
async function exportView(): Promise<void> {
  const bundle: ViewPreset = {
    exampleId:    currentExample.id,
    previewDepth: depth,
    colorScheme:  schemeForColorDepth(colorDepth).name,
    projection: {
      denom: Array.from(currentProj.denom),
      rowX:  Array.from(currentProj.rows[0]),
      rowY:  Array.from(currentProj.rows[1]),
      rowZ:  Array.from(currentProj.rows[2]),
      label: currentProj.label,
    },
    camera:   cameraSpecFromApp(app),
    viewport: viewportFromApp(app),
  };
  await saveViewPreset('o5', bundle, (msg, ok) =>
    exportStatus.flash(msg, 2500, ok ? '#9ec79e' : '#d9a55c'));
}

function shotTimestamp(): string {
  return new Date().toISOString().replace(/[-:]|\..*/g, '').replace('T', '-');
}

function updateUI(): void {
  statsEl.text(`${stats.totalWords.toLocaleString()} words, ${stats.kept.toLocaleString()} drawn`);
  const e = currentExample;
  const src = e.source !== '—' ? ` <span style="opacity:.7">(${e.source})</span>` : '';
  // "Thin Monodromy in O(5)" name first when present (what collaborators cite),
  // then the Bajpai–Singh master number.
  const bdn = e.bdnLabel ? `<b>${e.bdnLabel}</b> · ` : '';
  exMeta.html(
    `${bdn}${e.label} — <b>${e.type}</b> · ${e.status}${src}<br>` +
    `α = (${e.alpha.join(', ')})<br>` +
    `β = (${e.beta.join(', ')})<br>` +
    (!currentSeedFound
      ? '<i>no loxodromic element found to initialize a point of the limit set</i>'
      : `B order: ${e.bInfinite ? 'infinite' : 'finite'} · γ = ${currentGamma}, |λ_max| ≈ ${currentLambda.toFixed(3)}`),
  );
}

updateUI();
app.start();
