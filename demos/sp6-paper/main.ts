/**
 * sp6-paper — the figure set for the Sp(6) thinness paper, and nothing else.
 *
 * Deliberately NOT a browser. The dropdown holds exactly the nine panels of the
 * paper's three-row comparison (see `examples/hypergeometric/paperFigures.ts`);
 * no catalog is reachable from here. Curation happens elsewhere — you look at
 * candidates in sp6-explorer, decide, and edit FIGURES.
 *
 * Two things this demo does that a browser must not:
 *
 *   - It pins the seed word. Every figure is seeded from γ = TBT, the word the
 *     paper's §5 names, rather than the per-group auto-search. That is what
 *     makes the figures reproducible from the text. The panel shows the true
 *     spectral gap |λ₁/λ₂| and turns amber if a figure falls below the ≥ 10 the
 *     paper claims — so a bad swap is caught while curating.
 *   - It remembers a framing PER FIGURE. Nine panels that each need their own
 *     camera would otherwise mean re-framing every time you switch. "save
 *     framing" stores the current view for the current figure; "write all
 *     framings" persists the whole set to
 *     outputs/presets/sp6-paper-view-preset.json, which is re-read at startup.
 *
 * Everything else is the standard generic machinery: BFS orbit → projective
 * chart → instanced spheres.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { ControlPanel } from '@/app/ControlPanel';
import { createSphereMaterial } from '@/app/instancedSpheres';
import { buildLimitSetMesh } from '@/app/limitSetMesh';
import { cameraSpecFromApp, viewportFromApp, saveViewPreset } from '@/app/viewExport';

import {
  FIGURES, ROW_TITLES, figureById, figureExample, figureAction, seedPaperFigure,
  PAPER_MIN_GAP, PAPER_SEED_NAME, type PaperFigure, type PaperSeed,
} from '@/examples/hypergeometric/paperFigures';
import { paletteForSymplectic as paletteForScheme } from '@/examples/hypergeometric/palette';
import type { ViewPreset } from '@/examples/hypergeometric/viewPreset';
import { embeddingFromPreset } from '@/core/viewPreset';
import type { GroupAction } from '@/core/group';
import { generateOrbit, type Orbit } from '@/core/orbit';
import {
  type ChartEmbedding, fitPCAChartEmbedding, fitAutoChartEmbedding,
} from '@/core/chart';
import { schemeForColorDepth } from '@/render/colorScheme.ts';
// Domain layer — used by the Fig 4 figures (C-32's ping-pong domain).
import {
  c32Chart, coneBoundedInChart, copiesFor, copyCone,
  DEFAULT_COORD, DEFAULT_DENOM, DEFAULT_AXES,
} from '@/examples/hypergeometric/c32-domain';
import { coneDomainMesh } from '@/app/convexMesh';

const GROUP_TAG = 'sp6-paper';
const PRESET_URL = `/outputs/presets/${GROUP_TAG}-view-preset.json`;

const DEFAULT_DEPTH = 12;
const DEFAULT_RADIUS = 0.025;
const DEFAULT_CHART = '0';

const app = new App({ antialias: true });
app.scene.background = new THREE.Color(0xffffff);   // figures render on white

const { material, uniforms } = createSphereMaterial();

// ─── State ──────────────────────────────────────────────────────────────────

let currentFigure!:    PaperFigure;
let currentAction!:    GroupAction;
let currentSeed!:      PaperSeed;
let currentOrbit!:     Orbit;
let currentProj!:      ChartEmbedding;
let currentMesh: THREE.Mesh | null = null;
let depth = DEFAULT_DEPTH;
let colorDepth = 0;
let stats = { kept: 0, totalWords: 0 };

/** figure id → its saved framing. The whole point of a per-paper demo. */
const framings = new Map<string, ViewPreset>();

function loadFigure(id: string): void {
  currentFigure = figureById(id);
  currentAction = figureAction(currentFigure);
  currentSeed = seedPaperFigure(currentAction);
  const ex = figureExample(currentFigure);
  console.log(
    `[${GROUP_TAG}] ${currentFigure.label} = ${ex.label}: γ = ${currentSeed.name}` +
    `, |λ₁| = ${currentSeed.lambdaMax.toFixed(3)}, gap = ${currentSeed.gap.toFixed(3)}` +
    (currentSeed.meetsGap ? '' : `  ⚠ below the ≥${PAPER_MIN_GAP} claimed in §5`),
  );
}

function regenerateOrbit(N: number): void {
  currentOrbit = generateOrbit(currentAction, currentSeed.basepoint, N);
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
  if (value === 'domain') {
    const coord = currentFigure.domain?.coord ?? DEFAULT_COORD;
    currentProj = c32Chart(coord, DEFAULT_DENOM, DEFAULT_AXES);
    return;
  }
  currentProj = value === 'auto'
    ? fitAutoChartEmbedding(currentOrbit)
    : fitPCAChartEmbedding(currentOrbit, parseInt(value, 10));
}

// ─── Domain layer ℙ(K) — the Fig 4 figures ───────────────────────────────────
//
// Driven entirely by the figure record: a figure with `domain` draws that family
// of translates g·K over Λ; every other figure draws Λ alone. There is no toggle,
// because which copies are shown IS what distinguishes Fig 4a/4b/4c — making them
// three figures rather than one figure with knobs means each gets its own saved
// framing and its own one-line render command.
//
// Rebuilt from the CURRENT chart, so switching charts re-projects the bodies
// rather than leaving stale geometry behind.

const DOMAIN_SIZE = 0.006;
const DOMAIN_BODY_OPACITY = 0.35;
let domainObjs: ReturnType<typeof coneDomainMesh>[] = [];

function clearDomain(): void {
  for (const o of domainObjs) { app.scene.remove(o.group); o.dispose(); }
  domainObjs = [];
}

function rebuildDomain(): void {
  clearDomain();
  const spec = currentFigure.domain;
  if (!spec) return;
  for (const copy of copiesFor(spec.copies)) {
    const cone = copyCone(copy.g);
    const d = coneDomainMesh(cone, currentProj, {
      edgeColor: copy.edge, tubeRadius: DOMAIN_SIZE,
      vertexColor: copy.vertex, vertexRadius: DOMAIN_SIZE * 1.6,
      bodyColor: copy.body, bodyOpacity: DOMAIN_BODY_OPACITY,
    }, {
      showVertices: true, showEdges: true, showBody: true,   // wireframe + body
      showInterior: false, hullEdges: true,
    });
    app.scene.add(d.group);
    domainObjs.push(d);
    if (!coneBoundedInChart(cone, currentProj)) {
      console.warn(
        `[${GROUP_TAG}] ${currentFigure.label}: ${copy.label} is UNBOUNDED in this ` +
        'chart, so it draws as two pieces running to infinity. The "ℙ(K)-adapted" ' +
        'chart is the framing where the copies are bounded.',
      );
    }
  }
}

/**
 * Offer the ℙ(K)-adapted chart exactly when the current figure has a domain, and
 * default to it there.
 *
 * The copies are clean convex bodies only in a chart where their cones are
 * BOUNDED; in the PCA charts they cross the hyperplane at infinity and draw as
 * two pieces running to opposite sides. `c32-domain` supplies the known-good
 * framing (u-basis, patch e₀, axes 2/4/5), which is what this option selects.
 */
function syncDomainChart(): void {
  const on = currentFigure.domain !== undefined;
  const opts = selChart.element;
  const has = Array.from(opts.options).some((o) => o.value === 'domain');
  if (on && !has) {
    const o = document.createElement('option');
    o.value = 'domain';
    o.textContent = 'ℙ(K)-adapted (u-basis, e₀ patch)';
    opts.appendChild(o);
  } else if (!on && has) {
    if (selChart.value === 'domain') selChart.set(DEFAULT_CHART);
    opts.querySelector('option[value="domain"]')?.remove();
  }
  // A domain figure with no saved framing starts in the chart that shows it.
  if (on && !framings.has(currentFigure.id)) selChart.set('domain');
}

/** Restore a saved framing — chart, depth and camera — onto the live app. */
function applyFraming(p: ViewPreset): void {
  depth = p.previewDepth;
  slDepth.set(depth);
  regenerateOrbit(depth);
  currentProj = embeddingFromPreset(p.projection);
  rebuildMesh(false);                       // never autofit over a saved camera
  const cam = app.camera as THREE.PerspectiveCamera;
  cam.position.set(...p.camera.position);
  cam.up.set(...p.camera.up);
  cam.fov = p.camera.fov;
  cam.updateProjectionMatrix();
  app.controls.target.set(...p.camera.target);
  app.controls.update();
}

/** Switch figures: restore this figure's framing if it has one, else autofit. */
function showFigure(id: string): void {
  loadFigure(id);
  syncDomainChart();        // before the chart is applied: may add/remove 'domain'
  const saved = framings.get(id);
  if (saved) {
    applyFraming(saved);
  } else {
    depth = DEFAULT_DEPTH;
    slDepth.set(DEFAULT_DEPTH);
    regenerateOrbit(depth);
    applyChartSelection(selChart.value);
    rebuildMesh(true);
  }
  rebuildDomain();
  updateUI();
}

function currentFraming(): ViewPreset {
  return {
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
}

// ─── Initial load ───────────────────────────────────────────────────────────

loadFigure(FIGURES[0].id);
regenerateOrbit(depth);
currentProj = fitPCAChartEmbedding(currentOrbit, 0);
rebuildMesh(true);

// ─── HUD ────────────────────────────────────────────────────────────────────

const panel = new ControlPanel({ title: 'Sp(6) — paper figures' });

const selFigure = panel.select({
  label: 'figure',
  options: FIGURES.map((f) => ({
    value: f.id,
    label: `${f.label} · ${ROW_TITLES[f.row]} · ${figureExample(f).label}`,
  })),
  value: FIGURES[0].id,
  onChange: showFigure,
});
const figMeta = panel.text({ variant: 'meta' });
const seedMeta = panel.text({ variant: 'meta' });

panel.separator();

const slDepth = panel.slider({
  label: 'depth N',
  min: 4, max: 13, step: 1, value: depth,
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
    { value: '0', label: 'v₁ chart (PCA axes)' },
    { value: '1', label: 'v₂ chart (PCA axes)' },
    { value: '2', label: 'v₃ chart (PCA axes)' },
    { value: '3', label: 'v₄ chart (PCA axes)' },
    { value: '4', label: 'v₅ chart (PCA axes)' },
    { value: '5', label: 'v₆ chart (PCA axes)' },
    { value: 'auto', label: 'auto-chart (overall PCA)' },
  ],
  value: DEFAULT_CHART,
  onChange: (v) => { applyChartSelection(v); rebuildMesh(true); rebuildDomain(); updateUI(); },
});

panel.select({
  label: 'color by',
  options: [
    { value: '0', label: 'grayscale' },
    { value: '1', label: 'last letter (g_n)' },
    { value: '2', label: '2nd-to-last letter (g_{n−1})' },
    { value: '3', label: '3rd-to-last letter (g_{n−2})' },
  ],
  value: '0',
  onChange: (v) => { colorDepth = parseInt(v, 10); rebuildMesh(false); updateUI(); },
});

panel.separator();

// ─── Per-figure framing ─────────────────────────────────────────────────────

panel.button({
  label: 'save framing (this figure)',
  onClick: () => {
    framings.set(currentFigure.id, currentFraming());
    frameStatus.flash(`framed ${currentFigure.label} — ${framings.size}/${FIGURES.length} stored`, 2500, '#9ec79e');
    updateUI();
  },
});

panel.button({
  label: 'write all framings to disk',
  onClick: async () => {
    framings.set(currentFigure.id, currentFraming());   // don't lose the live one
    const bundle = { figures: Object.fromEntries(framings) };
    await saveViewPreset(GROUP_TAG, bundle, (msg, ok) =>
      frameStatus.flash(msg, 3000, ok ? '#9ec79e' : '#d9a55c'));
  },
});

panel.button({
  label: 'clear this figure’s framing',
  onClick: () => {
    framings.delete(currentFigure.id);
    applyChartSelection(selChart.value);
    rebuildMesh(true);
    frameStatus.flash(`cleared ${currentFigure.label}`, 2000, '#d9a55c');
    updateUI();
  },
});

const frameStatus = panel.text({ variant: 'meta' });

panel.separator();

const modeEl  = panel.text({ variant: 'mode' });
const statsEl = panel.text({ variant: 'stats' });

panel.button({
  label: 'screenshot',
  onClick: () => app.screenshot(`${GROUP_TAG}-${currentFigure.id}_${stats.kept}pts.png`),
});

panel.button({
  label: 'reset view (keep figure)',
  onClick: () => {
    depth = DEFAULT_DEPTH;
    slDepth.set(DEFAULT_DEPTH);
    selChart.set(DEFAULT_CHART);
    slFov.set(DEFAULT_FOV);
    app.camera.fov = DEFAULT_FOV;
    app.camera.updateProjectionMatrix();
    regenerateOrbit(depth);
    applyChartSelection(DEFAULT_CHART);
    rebuildMesh(true);
    updateUI();
  },
});

function updateUI(): void {
  const ex = figureExample(currentFigure);
  figMeta.html(
    `<b>${currentFigure.label}</b> — ${ex.label} (${ex.status})<br>` +
    `${currentFigure.caption}<br>` +
    `α = (${ex.alpha.join(', ')})<br>` +
    `β = (${ex.beta.join(', ')})`,
  );
  const gapNote = currentSeed.meetsGap
    ? `gap ${currentSeed.gap.toFixed(2)}`
    : `<span style="color:#d9a55c">gap ${currentSeed.gap.toFixed(2)} &lt; ${PAPER_MIN_GAP} claimed in §5</span>`;
  seedMeta.html(
    `γ = ${PAPER_SEED_NAME} (pinned) · |λ₁| = ${currentSeed.lambdaMax.toFixed(2)} · ${gapNote}` +
    (framings.has(currentFigure.id) ? '<br>framing: saved' : '<br>framing: none (autofit)'),
  );
  statsEl.text(`${stats.totalWords.toLocaleString()} words, ${stats.kept.toLocaleString()} drawn`);
  modeEl.text(`view: ${currentProj.pretty}`);
}

// ─── Restore saved framings, if any ─────────────────────────────────────────
// Best-effort: the file may not exist yet, and in a built bundle there is no
// dev server to have written one. Never blocks startup.

void (async () => {
  try {
    const r = await fetch(PRESET_URL);
    if (!r.ok) return;
    const data = await r.json() as { figures?: Record<string, ViewPreset> };
    for (const [id, p] of Object.entries(data.figures ?? {})) {
      if (FIGURES.some((f) => f.id === id)) framings.set(id, p);
    }
    if (framings.size === 0) return;
    console.log(`[${GROUP_TAG}] restored ${framings.size} saved framing(s)`);
    const live = framings.get(currentFigure.id);
    if (live) applyFraming(live);
    updateUI();
  } catch { /* no dev server / no preset yet — autofit is fine */ }
})();

syncDomainChart();
updateUI();
selFigure.set(FIGURES[0].id);

app.start();
