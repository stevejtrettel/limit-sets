/**
 * The hypergeometric atlas viewer — the whole live demo for a hypergeometric
 * (α, β) catalog, parameterised by the catalog. Every atlas demo is one call to
 * `mountHypergeometricAtlas`; nothing degree-specific lives here.
 *
 * Two dropdowns: a table (degree + invariant form) and, within it, a group —
 * banded by α, since the classification lists are blocked by α with β varying.
 * Each table carries its walk: the orthogonal tables free-product on {T, B}
 * (T = B·A⁻¹ an involution), the symplectic tables free on {A, B} (T is a
 * transvection). Definite tables (O(n)) are finite groups — no limit set; they
 * are listed but draw nothing.
 *
 * Render path: auto-found loxodromic seed (parabolic fallback when the search
 * fails — still a limit point for the infinite groups) → non-backtracking BFS →
 * projective chart (dimension-adaptive: RP¹ collapses to a line, RP² to a
 * plane) → instanced spheres. The "save framing for render" button exports the
 * view for the family's offline render script.
 */

import * as THREE from 'three';
import { App } from './App.ts';
import { ControlPanel } from './ControlPanel.ts';
import { createSphereMaterial } from './instancedSpheres.ts';
import { buildLimitSetMesh } from './limitSetMesh.ts';
import { cameraSpecFromApp, viewportFromApp, saveViewPreset } from './viewExport.ts';

import type {
  AtlasCatalog, AtlasExample, AtlasTable,
} from '../examples/hypergeometric/atlasCatalog.ts';
import {
  hypergeometricAction, WALK_LABELS, WALK_FALLBACK, type Walk,
} from '../examples/hypergeometric/recipe.ts';
import { paletteForOrthogonal, paletteForSymplectic } from '../examples/hypergeometric/palette.ts';
import type { ViewPreset } from '../examples/hypergeometric/viewPreset.ts';
import type { GroupAction } from '../core/group.ts';
import { seedFromLoxodromic } from '../core/seed.ts';
import { generateOrbit, type Orbit } from '../core/orbit.ts';
import {
  type ChartEmbedding, fitPCAChartEmbedding, fitAutoChartEmbedding, EPS_CHART,
} from '../core/chart.ts';
import { schemeForColorDepth } from '../render/colorScheme.ts';

export interface AtlasViewerConfig {
  catalog: AtlasCatalog;
  /** Group tag for saved framings — must be in vite.config's ALLOWED_GROUPS.
   *  Stable identifier: presets key off it, so never change one. */
  groupTag: string;
  /** Panel title. */
  title: string;
  /** Panel blurb, as HTML. */
  blurb: string;
  /** Table shown on load. */
  defaultTable: string;
  /** Screenshot filename + console log prefix. */
  shotPrefix: string;
}

const DEFAULT_RADIUS = 0.02;
/** An axis chart is listed only if it retains at least this share of the orbit. */
const MIN_CHART_SHARE = 0.05;

/** Depth economics per walk: the free-product tree is ~2^N, the free tree ~3^N. */
const WALK_DEPTH: Record<Walk, { def: number; max: number }> = {
  'free-product': { def: 13, max: 18 },
  'free':         { def: 10, max: 12 },
};
const WALK_PALETTE: Record<Walk, typeof paletteForOrthogonal> = {
  'free-product': paletteForOrthogonal,
  'free':         paletteForSymplectic,
};

const SUB: Record<string, string> = { '0':'₀','1':'₁','2':'₂','3':'₃','4':'₄','5':'₅','6':'₆','7':'₇','8':'₈','9':'₉' };
const subscript = (n: number): string => String(n).split('').map((c) => SUB[c]).join('');

export function mountHypergeometricAtlas(cfg: AtlasViewerConfig): void {
  const { catalog, shotPrefix } = cfg;

  const app = new App({ antialias: true });
  app.scene.background = new THREE.Color(0xf2f2f2);

  const { material, uniforms } = createSphereMaterial();

  // ─── State ──────────────────────────────────────────────────────────────────

  let currentTable!:     AtlasTable;
  let currentExample!:   AtlasExample;
  let currentAction!:    GroupAction;
  let currentBasepoint!: Float64Array;
  let currentLambda = NaN;
  let currentGamma = '—';
  let currentFallback = false;
  /** False for the definite (finite) tables — nothing to draw. */
  let currentHasLimitSet = true;
  let currentOrbit:      Orbit | null = null;
  let currentProj!:      ChartEmbedding;
  let currentMesh: THREE.Mesh | null = null;
  let depth = WALK_DEPTH['free-product'].def;
  let colorDepth = 0;
  let stats = { kept: 0, totalWords: 0 };

  const paletteForScheme: typeof paletteForOrthogonal = (scheme) =>
    WALK_PALETTE[currentTable.walk](scheme);

  function clearMesh(): void {
    if (currentMesh) {
      app.scene.remove(currentMesh);
      currentMesh.geometry.dispose();
      currentMesh = null;
    }
    stats = { kept: 0, totalWords: 0 };
  }

  function loadExample(id: string): void {
    const ex = catalog.examplesInTable(currentTable.key).find((e) => e.id === id);
    if (!ex) throw new Error(`unknown atlas group id: ${id}`);
    currentExample = ex;
    currentHasLimitSet = !currentTable.finite;
    if (!currentHasLimitSet) {
      console.log(`[${shotPrefix} ${ex.id}] ${currentTable.form} is definite — finite group, no limit set`);
      return;
    }
    currentAction = hypergeometricAction(ex.alpha, ex.beta, currentTable.walk);
    const s = seedFromLoxodromic(currentAction, {
      labels: WALK_LABELS[currentTable.walk],
      fallbackWord: WALK_FALLBACK[currentTable.walk],
    });
    currentBasepoint = s.basepoint;
    currentLambda = s.lambdaMax;
    currentGamma = s.name;
    currentFallback = s.fallback;
    console.log(
      `[${shotPrefix} ${ex.id}] (${currentTable.form}, ${currentTable.walk}): γ = ${s.name}` +
      `${s.fallback ? ' (parabolic fallback)' : ''}, |λ_max| ≈ ${s.lambdaMax.toFixed(4)}, drift = ${s.drift.toFixed(6)}`,
    );
  }

  function regenerateOrbit(N: number): void {
    if (!currentHasLimitSet) { currentOrbit = null; return; }
    const t0 = performance.now();
    currentOrbit = generateOrbit(currentAction, currentBasepoint, N);
    console.log(`[${shotPrefix} ${currentExample.id}] BFS depth=${N}  words=${currentOrbit.count}  (${(performance.now() - t0).toFixed(0)}ms)`);
  }

  function rebuildMesh(autofit: boolean): void {
    if (!currentOrbit) { clearMesh(); return; }
    const { mesh, kept } = buildLimitSetMesh({
      app, material, embedding: currentProj, orbit: currentOrbit,
      colorDepth, paletteForScheme, previous: currentMesh, autofit,
    });
    currentMesh = mesh;
    stats = { kept, totalWords: currentOrbit.count };
  }

  function applyChartSelection(value: string): void {
    if (!currentOrbit) return;
    currentProj = value === 'auto'
      ? fitAutoChartEmbedding(currentOrbit)
      : fitPCAChartEmbedding(currentOrbit, parseInt(value, 10));
  }

  function selectGroup(id: string): void {
    loadExample(id);
    regenerateOrbit(depth);
    populateCharts();
    applyChartSelection(selChart.value);
    rebuildMesh(true);
    updateUI();
  }

  function selectTable(key: string): void {
    currentTable = catalog.tableByKey(key);
    const d = WALK_DEPTH[currentTable.walk];
    depth = d.def;
    slDepth.element.max = String(d.max);
    slDepth.set(depth);
    populateGroups();
    selectGroup(selGroup.value);
  }

  // ─── Initial load ───────────────────────────────────────────────────────────

  currentTable = catalog.tableByKey(cfg.defaultTable);
  loadExample(catalog.examplesInTable(cfg.defaultTable)[0].id);
  regenerateOrbit(depth);
  currentProj = fitAutoChartEmbedding(currentOrbit!);
  rebuildMesh(true);

  // ─── HUD ────────────────────────────────────────────────────────────────────

  const panel = new ControlPanel({ title: cfg.title });

  panel.text({ variant: 'meta' }).html(cfg.blurb);

  const groupFolder = panel.folder('Group', { open: true });

  const selTable = groupFolder.select({
    label: 'table',
    options: catalog.tables.map((t) => ({
      value: t.key,
      label: `degree ${t.degree} — ${t.form} (${t.count})${t.finite ? ' · finite' : ''}`,
    })),
    value: cfg.defaultTable,
    onChange: (key) => selectTable(key),
  });

  const selGroup = groupFolder.select({
    label: 'group',
    options: [],
    value: '',
    onChange: (id) => selectGroup(id),
  });

  /** Group dropdown: one banded block per α tuple (the source lists are blocked
   *  by α with β varying — contiguously, so the blocks are the lists' own), the
   *  options labelled by β. The trailing №n is just the row's position in its
   *  source list — a stable citation key, not a mathematical ordering, so it
   *  sits at the end where it stays out of the way. */
  function populateGroups(): void {
    const examples = catalog.examplesInTable(currentTable.key);
    selGroup.setOptions(
      examples.map((e) => ({
        value: e.id,
        label: `β = (${e.beta.join(', ')})   ${e.label}`,
        group: `α = (${e.alpha.join(', ')})`,
      })),
      examples[0].id,
    );
  }
  populateGroups();

  const exMeta = groupFolder.text({ variant: 'meta' });

  const viewFolder = panel.folder('View');

  const selChart = viewFolder.select({
    label: 'chart',
    options: [],
    value: 'auto',
    onChange: (v) => { applyChartSelection(v); rebuildMesh(true); updateUI(); },
  });

  /** Chart menu for the CURRENT orbit: auto-chart plus each PCA axis that keeps
   *  a usable share of the orbit (a chart drops points with |v_k| < EPS_CHART). */
  function chartOptions(): { value: string; label: string }[] {
    const opts = [{ value: 'auto', label: 'auto-chart (overall PCA)' }];
    if (!currentOrbit) return opts;
    const { vecs, count, stateDim } = currentOrbit;
    for (let k = 0; k < stateDim; k++) {
      let kept = 0;
      for (let i = 0; i < count; i++) if (Math.abs(vecs[i * stateDim + k]) >= EPS_CHART) kept++;
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
    selChart.setOptions(chartOptions(), 'auto');
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
    min: 3, max: WALK_DEPTH[currentTable.walk].max, step: 1, value: depth,
    onChange: (v) => {
      depth = v;
      regenerateOrbit(v);
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
      selChart.set('auto');
      slFov.set(DEFAULT_FOV);
      app.camera.fov = DEFAULT_FOV; app.camera.updateProjectionMatrix();
      selectTable(selTable.value);
    },
  });

  panel.separator();

  const statsEl = panel.text({ variant: 'stats' });

  panel.button({
    label: 'screenshot',
    onClick: () => app.screenshot(
      `${shotPrefix}-${currentExample.id}_${currentProj.label}_${stats.kept}pts_${shotTimestamp()}.png`,
    ),
  });

  panel.separator();

  panel.button({ label: 'save framing for render', onClick: exportView });
  const exportStatus = panel.text({ variant: 'meta' });

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
    await saveViewPreset(cfg.groupTag, bundle, (msg, ok) =>
      exportStatus.flash(msg, 2500, ok ? '#9ec79e' : '#d9a55c'));
  }

  function shotTimestamp(): string {
    return new Date().toISOString().replace(/[-:]|\..*/g, '').replace('T', '-');
  }

  function updateUI(): void {
    statsEl.text(`${stats.totalWords.toLocaleString()} words, ${stats.kept.toLocaleString()} drawn`);
    const e = currentExample;
    const t = currentTable;
    const gens = t.walk === 'free-product'
      ? 'walk {T, B}, T = B·A⁻¹ an involution'
      : 'walk {A, A⁻¹, B, B⁻¹}';
    const orders =
      `A: ${e.aInfinite ? 'infinite' : 'finite'} order · B: ${e.bInfinite ? 'infinite' : 'finite'} order`;
    exMeta.html(
      `<b>${e.id}</b> — <b>${t.form}</b> in RP<sup>${t.degree - 1}</sup> · ${gens}<br>` +
      `α = (${e.alpha.join(', ')})<br>` +
      `β = (${e.beta.join(', ')})<br>` +
      (!currentHasLimitSet
        ? '<i>definite form — finite group, no limit set</i>'
        : `${orders}<br>γ = ${currentGamma}${currentFallback ? ' (parabolic fallback)' : ''}, ` +
          `|λ_max| ≈ ${currentLambda.toFixed(3)}`),
    );
  }

  updateUI();
  app.start();
}
