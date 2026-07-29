/**
 * sp6-paper-appendix — the appendix figure set, and nothing else.
 *
 * Eight degree-5 orthogonal groups in RP⁴: the seven unresolved O(3,2) data of
 * Table 2 (T2.1…T2.7) plus the one open O(4,1) case the appendix resolves.
 * These are exactly the atlas rows still marked `open`.
 *
 * Sibling of the `sp6-paper` demo, deliberately separate. That one shows
 * degree-6 SYMPLECTIC groups in RP⁵ on the 4-letter free alphabet; this one
 * shows degree-5 ORTHOGONAL groups in RP⁴ on the 3-letter free-product alphabet
 * {T, B, B⁻¹}. Different dimension, different ambient group, different word
 * tree — the two sets are not visually comparable, and keeping them in separate
 * demos is what stops a reader treating them as one table.
 *
 * Every figure is seeded from the same pinned γ = B⁻¹TBT (see
 * `@/examples/hypergeometric/paperAppendixFigures`), so the figures are
 * reproducible from the text. The panel reports each figure's spectral gap
 * |λ₁/λ₂| and flags any that falls below the paper's threshold.
 *
 * "save framing for render" writes outputs/presets/sp6-paper-appendix-view-preset.json,
 * which the matching render script reads.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { ControlPanel } from '@/app/ControlPanel';
import { createSphereMaterial } from '@/app/instancedSpheres';
import { buildLimitSetMesh } from '@/app/limitSetMesh';
import { cameraSpecFromApp, viewportFromApp, saveViewPreset } from '@/app/viewExport';

import {
  FIGURES, ROW_TITLES, figureById, figureExample, figureAction, seedAppendixFigure,
  APPENDIX_MIN_GAP, APPENDIX_SEED_NAME, type AppendixFigure, type AppendixSeed,
} from '@/examples/hypergeometric/paperAppendixFigures';
import { paletteForOrthogonal as paletteForScheme } from '@/examples/hypergeometric/palette';
import type { ViewPreset } from '@/examples/hypergeometric/viewPreset';
import type { GroupAction } from '@/core/group';
import { generateOrbit, type Orbit } from '@/core/orbit';
import {
  type ChartEmbedding, fitPCAChartEmbedding, fitAutoChartEmbedding,
} from '@/core/chart';
import { schemeForColorDepth } from '@/render/colorScheme.ts';

const app = new App({ antialias: true });
app.scene.background = new THREE.Color(0xf2f2f2);

const { material, uniforms } = createSphereMaterial();

/** Group tag for saved framings. Stable identifier — do not change. */
const GROUP_TAG = 'sp6-paper-appendix';
const DEFAULT_FIGURE_ID = 'o41';   // the case the appendix resolves
const DEFAULT_DEPTH = 14;
const DEFAULT_RADIUS = 0.02;

// ─── State ────────────────────────────────────────────────────────────────────

let currentFigure!:    AppendixFigure;
let currentAction!:    GroupAction;
let currentSeed!:      AppendixSeed;
let currentOrbit!:     Orbit;
let currentProj!:      ChartEmbedding;
let currentMesh: THREE.Mesh | null = null;
let depth = DEFAULT_DEPTH;
let colorDepth = 0;
let stats = { kept: 0, totalWords: 0 };

function loadFigure(id: string): void {
  currentFigure = figureById(id);
  currentAction = figureAction(currentFigure);
  currentSeed = seedAppendixFigure(currentAction);
  const ex = figureExample(currentFigure);
  console.log(
    `[appendix ${currentFigure.label}] ${ex.label} (${ex.type}, ${ex.status}): ` +
    `γ = ${currentSeed.name}, |λ₁| = ${currentSeed.lambdaMax.toFixed(3)}, ` +
    `gap = ${currentSeed.gap.toFixed(2)}${currentSeed.meetsGap ? '' : '  ⚠ below threshold'}, ` +
    `drift = ${currentSeed.drift.toExponential(2)}`,
  );
}

function regenerateOrbit(N: number): void {
  const t0 = performance.now();
  currentOrbit = generateOrbit(currentAction, currentSeed.basepoint, N);
  console.log(`[appendix ${currentFigure.label}] BFS depth=${N}  words=${currentOrbit.count}  (${(performance.now() - t0).toFixed(0)}ms)`);
}

function rebuildMesh(autofit: boolean): void {
  const { mesh, kept } = buildLimitSetMesh({
    app, material, embedding: currentProj, orbit: currentOrbit,
    colorDepth, paletteForScheme, previous: currentMesh, autofit,
  });
  currentMesh = mesh;
  stats = { kept, totalWords: currentOrbit.count };
}

function applyChartSelection(value: string): void {
  currentProj = value === 'auto'
    ? fitAutoChartEmbedding(currentOrbit)
    : fitPCAChartEmbedding(currentOrbit, parseInt(value, 10));
}

function selectFigure(id: string): void {
  loadFigure(id);
  regenerateOrbit(depth);
  applyChartSelection(selChart.value);
  rebuildMesh(true);
  updateUI();
}

// ─── Initial load ─────────────────────────────────────────────────────────────

loadFigure(DEFAULT_FIGURE_ID);
regenerateOrbit(depth);
currentProj = fitAutoChartEmbedding(currentOrbit);
rebuildMesh(true);

// ─── HUD ────────────────────────────────────────────────────────────────────

const panel = new ControlPanel({ title: 'appendix — open O(5) cases' });

panel.text({ variant: 'meta' }).html(
  'The eight groups the degree-5 orthogonal atlas still lists as open: Table 2’s ' +
  'seven O(3,2) data, proved arithmetic here, and the O(4,1) case, proved thin. ' +
  'Limit sets in RP⁴, walked on {T, B, B⁻¹}. The atlas itself is unchanged.',
);

// ─── Figure folder ────────────────────────────────────────────────────────────
const figFolder = panel.folder('Figure', { open: true });

const selFigure = figFolder.select({
  label: 'figure',
  options: FIGURES.map((f) => ({ value: f.id, label: optionLabel(f) })),
  value: DEFAULT_FIGURE_ID,
  onChange: (id) => selectFigure(id),
});

/**
 * Case name · ambient group · atlas cross-reference.
 *
 * Kept self-contained on purpose: when the <select> is CLOSED only the chosen
 * option's text is visible — the <optgroup> header is not — so the label has to
 * identify the figure on its own. The header carries only the paper's claim,
 * which is the one thing repeated across a whole group.
 */
function optionLabel(f: AppendixFigure): string {
  return `${f.label}  ·  ${figureExample(f).type}  ·  atlas ${figureExample(f).label}`;
}

/** Group the options under one header per claim, the way o5-explorer does. */
function populateFigures(): void {
  const el = selFigure.element;
  el.innerHTML = '';
  let header = '';
  let og: HTMLOptGroupElement | null = null;
  for (const f of FIGURES) {
    const h = ROW_TITLES[f.row];
    if (h !== header) {
      og = document.createElement('optgroup');
      og.label = h;
      el.appendChild(og);
      header = h;
    }
    const o = document.createElement('option');
    o.value = f.id;
    o.textContent = optionLabel(f);
    og!.appendChild(o);
  }
  selFigure.set(DEFAULT_FIGURE_ID);
}
populateFigures();

const figMeta = figFolder.text({ variant: 'meta' });

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
    selectFigure(selFigure.value);
  },
});

panel.separator();

const statsEl = panel.text({ variant: 'stats' });

panel.button({
  label: 'screenshot',
  onClick: () => app.screenshot(
    `appendix-${currentFigure.id}_${currentProj.label}_${stats.kept}pts_${shotTimestamp()}.png`,
  ),
});

panel.separator();

panel.button({ label: 'save framing for render', onClick: exportView });
const exportStatus = panel.text({ variant: 'meta' });

async function exportView(): Promise<void> {
  const bundle: ViewPreset = {
    exampleId:    currentFigure.id,
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
  await saveViewPreset(GROUP_TAG, bundle, (msg, ok) =>
    exportStatus.flash(msg, 2500, ok ? '#9ec79e' : '#d9a55c'));
}

function shotTimestamp(): string {
  return new Date().toISOString().replace(/[-:]|\..*/g, '').replace('T', '-');
}

function updateUI(): void {
  statsEl.text(`${stats.totalWords.toLocaleString()} words, ${stats.kept.toLocaleString()} drawn`);
  const f = currentFigure;
  const ex = figureExample(f);
  const gapNote = currentSeed.meetsGap
    ? `gap = ${currentSeed.gap.toFixed(1)}`
    : `<span style="color:#d9a55c">gap = ${currentSeed.gap.toFixed(1)} &lt; ${APPENDIX_MIN_GAP}</span>`;
  figMeta.html(
    `<b>${f.label}</b> · <b>${ex.type}</b> · this paper: <b>${f.row}</b><br>` +
    `α = (${ex.alpha.join(', ')})<br>` +
    `β = (${ex.beta.join(', ')})<br>` +
    `(f, g) = ${f.factors}<br>` +
    `<span style="opacity:.7">atlas ${ex.label} (${ex.bdnLabel ?? '—'}) · published status: ` +
    `${ex.status} — unchanged until this paper appears</span><br>` +
    `γ = ${APPENDIX_SEED_NAME} (pinned) · |λ₁| = ${currentSeed.lambdaMax.toFixed(2)} · ${gapNote}`,
  );
}

updateUI();
app.start();
