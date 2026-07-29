/**
 * The odd all-half tower — Γ_d = ⟨Comp((x−1)^d), Comp((x+1)^d)⟩ for odd d ≥ 5,
 * browsable by DEGREE rather than by catalog row.
 *
 * Every other hypergeometric viewer here picks a group out of a finite
 * transcribed table. This one has a single knob, d, because the family is
 * generated: the group, the alphabet and the seed word are all the same
 * construction at every degree, and only the ambient dimension changes (the
 * limit set lives in RP^{d-1}). d = 5 is exactly row #48 of the Bajpai–Singh
 * O(5) atlas — the o5-explorer's default group — so the bottom of the tower is a
 * picture that already exists, and the slider walks up from there.
 *
 * Render path: fixed seed word γ = B²T (NOT the loxodromic search — see
 * `@/examples/hypergeometric/all-half-odd` for why the search is unsafe when both
 * generators are unipotent) → non-backtracking BFS over the {T, B, B⁻¹}
 * free-product alphabet, a 2^N tree → projective chart → instanced spheres.
 *
 * The chart is generic projective PCA, refitted per degree. That is honest for
 * any single d but NOT comparable ACROSS d — each degree picks its own frame,
 * sign and scale, so the picture will jump as the slider moves for reasons that
 * are numerical rather than mathematical. A canonical frame built from the
 * reflection walls A^i e₀ is the planned successor; until then, read each degree
 * on its own terms.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { ControlPanel } from '@/app/ControlPanel';
import { createSphereMaterial } from '@/app/instancedSpheres';
import { buildLimitSetMesh } from '@/app/limitSetMesh';
import { cameraSpecFromApp, viewportFromApp, saveViewPreset } from '@/app/viewExport';

import {
  DEGREES, allHalfOddAction, allHalfOddPolynomials, seedAllHalfOdd, exampleId,
} from '@/examples/hypergeometric/all-half-odd';
import { qFrameChart, normalFormChart } from '@/examples/hypergeometric/all-half-odd-normal-form';
import { paletteForOrthogonal as paletteForScheme } from '@/examples/hypergeometric/palette';
import type { ViewPreset } from '@/examples/hypergeometric/viewPreset';
import type { GroupAction } from '@/core/group';
import { generateOrbit, type Orbit } from '@/core/orbit';
import {
  type ChartEmbedding, fitPCAChartEmbedding, fitAutoChartEmbedding, EPS_CHART,
} from '@/core/chart';
import { schemeForColorDepth } from '@/render/colorScheme.ts';

const app = new App({ antialias: true });
app.scene.background = new THREE.Color(0xf2f2f2);

const { material, uniforms } = createSphereMaterial();

/** Group tag for saved framings. Stable identifier — do not change. */
const GROUP_TAG = 'allhalf-odd';
const DEFAULT_DEGREE = 5;      // = O(5) catalog row #48, the known picture
const DEFAULT_DEPTH = 14;
const DEFAULT_RADIUS = 0.02;
/** An axis chart is listed only if it retains at least this share of the orbit. */
const MIN_CHART_SHARE = 0.05;

// Digit prettifiers. These must be declared BEFORE the HUD section: the control
// panel evaluates slider `format` and builds the chart menu while it is being
// constructed, so a `const` defined lower in the file would still be in its
// temporal dead zone and throw at module load.
const SUP: Record<string, string> = { '0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹' };
const SUB: Record<string, string> = { '0':'₀','1':'₁','2':'₂','3':'₃','4':'₄','5':'₅','6':'₆','7':'₇','8':'₈','9':'₉' };
const superscript = (n: number): string => String(n).split('').map((c) => SUP[c]).join('');
const subscript   = (n: number): string => String(n).split('').map((c) => SUB[c]).join('');

// ─── State ────────────────────────────────────────────────────────────────────

let degree = DEFAULT_DEGREE;
let currentAction!:    GroupAction;
let currentBasepoint!: Float64Array;
let currentLambda = NaN;
let currentGamma = '';
let currentOrbit!:     Orbit;
let currentProj!:      ChartEmbedding;
let currentMesh: THREE.Mesh | null = null;
let depth = DEFAULT_DEPTH;
let colorDepth = 0;
let stats = { kept: 0, totalWords: 0 };

function loadDegree(d: number): void {
  degree = d;
  currentAction = allHalfOddAction(d);
  const s = seedAllHalfOdd(currentAction);
  currentBasepoint = s.basepoint;
  currentLambda = s.lambdaMax;
  currentGamma = s.name;
  console.log(
    `[allhalf-odd d=${d}] RP^${d - 1}: γ = ${s.name}, ` +
    `|λ_max| ≈ ${s.lambdaMax.toFixed(4)}, drift = ${s.drift.toExponential(2)}`,
  );
}

function regenerateOrbit(N: number): void {
  const t0 = performance.now();
  currentOrbit = generateOrbit(currentAction, currentBasepoint, N);
  console.log(`[allhalf-odd d=${degree}] BFS depth=${N}  words=${currentOrbit.count}  (${(performance.now() - t0).toFixed(0)}ms)`);
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
  if (value === 'auto')       { currentProj = fitAutoChartEmbedding(currentOrbit); return; }
  if (value === 'qframe')     { currentProj = qFrameChart(currentOrbit); return; }
  if (value === 'normalform') { currentProj = normalFormChart(currentOrbit); return; }
  currentProj = fitPCAChartEmbedding(currentOrbit, parseInt(value, 10));
}

function selectDegree(d: number): void {
  loadDegree(d);
  regenerateOrbit(depth);
  populateCharts();
  applyChartSelection(selChart.value);
  rebuildMesh(true);
  updateUI();
}

// ─── Initial load ─────────────────────────────────────────────────────────────

loadDegree(degree);
regenerateOrbit(depth);
currentProj = fitAutoChartEmbedding(currentOrbit);
rebuildMesh(true);

// ─── HUD ────────────────────────────────────────────────────────────────────

const panel = new ControlPanel({ title: 'odd all-half tower' });

panel.text({ variant: 'meta' }).html(
  'Γ<sub>d</sub> = ⟨Comp((x−1)<sup>d</sup>), Comp((x+1)<sup>d</sup>)⟩ for odd d ≥ 5 — ' +
  'one construction at every degree, drawn in RP<sup>d−1</sup>. ' +
  'At d = 5 this is O(5) atlas row #48.',
);

// ─── Group folder ─────────────────────────────────────────────────────────────
const groupFolder = panel.folder('Group', { open: true });

const slDegree = groupFolder.slider({
  label: 'degree d',
  min: DEGREES[0], max: DEGREES[DEGREES.length - 1], step: 2, value: degree,
  format: (v) => `${v}  (RP${superscript(v - 1)})`,
  onChange: (v) => selectDegree(v),
});

const exMeta = groupFolder.text({ variant: 'meta' });

// ─── View folder ──────────────────────────────────────────────────────────────
const viewFolder = panel.folder('View');

const selChart = viewFolder.select({
  label: 'chart',
  options: chartOptions(degree),
  value: 'auto',
  onChange: (v) => { applyChartSelection(v); rebuildMesh(true); updateUI(); },
});

/**
 * Chart menu for the CURRENT orbit: the overall PCA fit, plus the coordinate
 * charts that actually show something.
 *
 * A chart v ↦ v/(v·e_k) drops every point with |v_k| < EPS_CHART, and as d grows
 * the limit set concentrates away from the coordinate axes — by d = 17 the v₁
 * chart retains none of the orbit at all. Listing those would offer the viewer a
 * guaranteed blank screen, so an axis appears only when it keeps a usable share
 * of the points, with that share shown. Viability is measured by counting
 * survivors directly (O(count · d)) rather than by fitting each chart, which at
 * d = 25 would mean 25 eigendecompositions per rebuild.
 */
function chartOptions(d: number): { value: string; label: string }[] {
  const opts = [
    { value: 'auto', label: 'auto-chart (overall PCA)' },
    { value: 'qframe', label: 'Q-frame (standard signature)' },
    { value: 'normalform', label: 'normal-form coords ψ = P⁻¹x' },
  ];
  if (!currentOrbit) return opts;
  const { vecs, count } = currentOrbit;
  for (let k = 0; k < d; k++) {
    let kept = 0;
    for (let i = 0; i < count; i++) if (Math.abs(vecs[i * d + k]) >= EPS_CHART) kept++;
    const share = kept / count;
    if (share < MIN_CHART_SHARE) continue;
    opts.push({
      value: String(k),
      label: `v${subscript(k + 1)} chart (PCA axes)`
        + (share < 0.999 ? ` — ${(100 * share).toFixed(0)}% of orbit` : ''),
    });
  }
  return opts;
}

function populateCharts(): void {
  const opts = chartOptions(degree);
  const keep = opts.some((o) => o.value === selChart.value) ? selChart.value : 'auto';
  const el = selChart.element;
  el.innerHTML = '';
  for (const o of opts) {
    const opt = document.createElement('option');
    opt.value = o.value;
    opt.textContent = o.label;
    el.appendChild(opt);
  }
  selChart.set(keep);
}
populateCharts();

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
  onChange: (v) => {
    depth = v;
    regenerateOrbit(v);
    // Which coordinate charts are viable depends on the orbit, so the menu is
    // rebuilt here too; the selection may fall back to 'auto'.
    populateCharts();
    applyChartSelection(selChart.value);
    rebuildMesh(false);
    updateUI();
  },
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
    slDegree.set(DEFAULT_DEGREE);
    slFov.set(DEFAULT_FOV);
    app.camera.fov = DEFAULT_FOV; app.camera.updateProjectionMatrix();
    selChart.set('auto');          // silent; selectDegree reads it back
    selectDegree(DEFAULT_DEGREE);
  },
});

panel.separator();

const statsEl = panel.text({ variant: 'stats' });

panel.button({
  label: 'screenshot',
  onClick: () => app.screenshot(
    `allhalf-odd-d${degree}_${currentProj.label}_${stats.kept}pts_${shotTimestamp()}.png`,
  ),
});

panel.separator();

panel.button({ label: 'save framing for render', onClick: exportView });
const exportStatus = panel.text({ variant: 'meta' });

// ─── Export view for offline render ─────────────────────────────────────────

async function exportView(): Promise<void> {
  const bundle: ViewPreset = {
    exampleId:    exampleId(degree),
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

/** The defining polynomials, printed compactly for the panel. */
function polyLine(d: number): string {
  const { f, g } = allHalfOddPolynomials(d);
  const show = (c: readonly number[]): string =>
    c.length <= 8 ? c.join(', ') : `${c.slice(0, 4).join(', ')}, …, ${c.slice(-3).join(', ')}`;
  return `f = (x−1)<sup>${d}</sup> → [${show(f)}]<br>g = (x+1)<sup>${d}</sup> → [${show(g)}]`;
}

function updateUI(): void {
  statsEl.text(`${stats.totalWords.toLocaleString()} words, ${stats.kept.toLocaleString()} drawn`);
  const m = (degree - 1) / 2;
  exMeta.html(
    `<b>d = ${degree}</b> — limit set in RP<sup>${degree - 1}</sup>` +
    (degree === 5 ? ' <span style="opacity:.7">(= O(5) atlas #48)</span>' : '') + '<br>' +
    `${polyLine(degree)}<br>` +
    `γ = ${currentGamma}, |λ_max| ≈ ${currentLambda.toFixed(3)}, ` +
    `tr γ = −d(2d−1) = ${-degree * (2 * degree - 1)}<br>` +
    `<span style="opacity:.7">ℙΓ<sub>d</sub> ≅ (ℤ/2) ∗ ℤ; walls v<sub>i</sub> = A<sup>i</sup>e₀, ` +
    `i = 0…${degree - 1} (m = ${m})</span>`,
  );
}

updateUI();
app.start();
