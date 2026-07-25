/**
 * SU(2,1) — finite (p,q,r) complex hyperbolic triangle groups.
 *
 * Mirrors meet inside CH² at angles π/p, π/q, π/r; the 1-parameter family is
 * swept by the mirror-triple phase φ ∈ (φmin, 2π−φmin), with the classical
 * R-Fuchsian group at φ = π. Featured case (4,4,4), for Rich Schwartz:
 * the governing word is 1213 = ι₁ι₂ι₁ι₃ — when it is parabolic (the critical
 * φ*, one button-press away) or finite-order elliptic, the limit set is the
 * closure of a countable family of R-circles.
 *
 * The φ slider is normalized: u ∈ (0,1) maps onto the valid interval, so the
 * slider can never leave the signature-(2,1) region even when the orders
 * change. Diagnostics (vertex orders, 1213/123 classification with finite
 * orders, elliptic scan) update live; orbit + mesh rebuild on release.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { ControlPanel } from '@/app/ControlPanel';
import { createSphereMaterial } from '@/app/instancedSpheres';
import { buildLimitSetMesh } from '@/app/limitSetMesh';
import { cameraSpecFromApp, viewportFromApp, saveViewPreset } from '@/app/viewExport';

import type { GroupAction } from '@/core/group';
import { generateOrbit, type Orbit } from '@/core/orbit';
import type { SceneEmbedding } from '@/core/scene';
import { formatWord } from '@/core/seed';

import { schemeForColorDepth } from '@/render/colorScheme.ts';

import { stereographicEmbedding, heisenbergEmbedding } from '@/examples/complex-hyperbolic/embedding';
import {
  classifyElement, ellipticOrder, wordProduct, scanEllipticWords,
} from '@/examples/complex-hyperbolic/diagnostics';
import {
  TRIANGLE_LABELS, WORD_1213, WORD_123,
  trianglePhaseInterval, triangleGroupReflections, triangleGroupAction, seedTriangleGroup,
  findParabolicPhase, findEllipticPhase,
  type TriangleOrders,
} from '@/examples/complex-hyperbolic/triangleGroup';
import { paletteForScheme } from '@/examples/complex-hyperbolic/palette';
import { triSlug, type EmbeddingName, type TriViewPreset } from '@/examples/complex-hyperbolic/triViewPreset';

const app = new App({ antialias: true });
app.scene.background = new THREE.Color(0xffffff);
const { material, uniforms } = createSphereMaterial();

const DEFAULT_ORDERS: TriangleOrders = [4, 4, 4];
const DEFAULT_DEPTH = 13;
const DEFAULT_RADIUS = 0.005;
const DEFAULT_EMBEDDING: EmbeddingName = 'sphere-stereo';

const EMBEDDINGS: Record<EmbeddingName, SceneEmbedding> = {
  'sphere-stereo': stereographicEmbedding,
  'heisenberg':    heisenbergEmbedding,
};
const AUTOFIT_DIR: Record<EmbeddingName, readonly [number, number, number]> = {
  'sphere-stereo': [0.4, 0.4, 1],
  'heisenberg':    [0.7, 0.4, 0.6],
};

// ─── State ──────────────────────────────────────────────────────────────────

let orders: TriangleOrders = DEFAULT_ORDERS;
let u = 0.5;                       // normalized phase; φ = lo + u(hi − lo)
let depth = DEFAULT_DEPTH;
let colorDepth = 0;
let currentEmbeddingName: EmbeddingName = DEFAULT_EMBEDDING;
let currentEmbedding: SceneEmbedding = EMBEDDINGS[DEFAULT_EMBEDDING];
let currentAction: GroupAction | null = null;
let currentBasepoint: Float64Array | null = null;
let currentOrbit: Orbit | null = null;
let currentMesh: THREE.Mesh | null = null;
let currentSeedName = '';
let stats = { kept: 0, totalWords: 0 };

const U_EPS = 0.003;   // keep the slider strictly inside the open interval

function phaseOfU(uu: number): number {
  const [lo, hi] = trianglePhaseInterval(orders);
  return lo + Math.min(1 - U_EPS, Math.max(U_EPS, uu)) * (hi - lo);
}
const phi = (): number => phaseOfU(u);

// ─── Diagnostics (cheap, live) ──────────────────────────────────────────────

const OK = '#9ec79e', WARN = '#d9a55c', BAD = '#d97c7c', DIM = '#8a8f98';

function describeWord(name: string, word: readonly number[], refl: readonly Float64Array[]): string {
  const M = wordProduct(refl, word);
  const cls = classifyElement(M);
  if (cls.type === 'loxodromic') {
    return `<span style="color:${OK}">${name}: loxodromic (f = ${cls.f.toExponential(2)})</span>`;
  }
  if (cls.type === 'parabolic') {
    return `<span style="color:${WARN}">${name}: PARABOLIC (f = ${cls.f.toExponential(1)}) — R-circle regime</span>`;
  }
  const ord = ellipticOrder(M, 200);
  const color = ord === null ? BAD : WARN;
  const tag = ord === null ? 'elliptic, INFINITE order — non-discrete' : `elliptic of order ${ord} — R-circle regime`;
  return `<span style="color:${color}">${name}: ${tag} (f = ${cls.f.toExponential(2)})</span>`;
}

function diagnosticsHTML(): string {
  const p = phi();
  let refl: Float64Array[];
  try { refl = triangleGroupReflections(orders, p); } catch (e) {
    return `<span style="color:${BAD}">${String(e)}</span>`;
  }
  const lines: string[] = [];
  const [lo, hi] = trianglePhaseInterval(orders);
  lines.push(`<span style="color:${DIM}">φ = ${p.toFixed(5)}  ∈ (${lo.toFixed(3)}, ${hi.toFixed(3)});  φ = π is R-Fuchsian</span>`);
  const pairs: readonly (readonly [number, number])[] = [[0, 1], [1, 2], [2, 0]];
  const ords = pairs.map(([i, j]) => ellipticOrder(wordProduct(refl, [j, i]), 100) ?? NaN);
  lines.push(`<span style="color:${DIM}">vertex orders: (${ords.join(', ')})</span>`);
  lines.push(describeWord('1213', WORD_1213, refl));
  lines.push(describeWord('123 ', WORD_123, refl));
  lines.push(`<span style="color:${DIM}">γ = ${currentSeedName || '—'}</span>`);
  return lines.join('<br>');
}

// ─── Rebuild ────────────────────────────────────────────────────────────────

function fullRebuild(autofit: boolean): void {
  try {
    currentAction = triangleGroupAction(orders, phi());
    const s = seedTriangleGroup(currentAction);
    currentBasepoint = s.basepoint;
    currentSeedName = s.name;
  } catch (e) {
    currentSeedName = '(seeding failed)';
    console.warn('[su21-tri]', e);
    updateUI();
    return;
  }
  const t0 = performance.now();
  currentOrbit = generateOrbit(currentAction, currentBasepoint, depth);
  console.log(`[su21-tri] BFS depth=${depth} words=${currentOrbit.count} (${(performance.now() - t0).toFixed(0)}ms)`);
  rebuildMesh(autofit);
  updateUI();
}

function rebuildMesh(autofit: boolean): void {
  if (!currentOrbit) return;
  const { mesh, kept } = buildLimitSetMesh({
    app, material, embedding: currentEmbedding, orbit: currentOrbit,
    colorDepth, paletteForScheme,
    previous: currentMesh, autofit, autofitDir: AUTOFIT_DIR[currentEmbeddingName],
  });
  currentMesh = mesh;
  stats = { kept, totalWords: currentOrbit.count };
}

// ─── Panel ──────────────────────────────────────────────────────────────────

const panel = new ControlPanel({ title: 'SU(2,1) — (p,q,r) triangle groups' });

function orderInput(label: string, idx: number): void {
  panel.numberInput({
    label, value: DEFAULT_ORDERS[idx], min: 2, max: 100, step: 1,
    onChange: (v) => {
      const next: number[] = [...orders];
      next[idx] = Math.max(2, Math.round(v));
      orders = next as unknown as TriangleOrders;
      fullRebuild(true);
    },
  });
}
orderInput('n₁₂ (order of ι₁ι₂)', 0);
orderInput('n₂₃ (order of ι₂ι₃)', 1);
orderInput('n₃₁ (order of ι₃ι₁)', 2);

const slPhase = panel.slider({
  label: 'phase u  (0.5 = R-Fuchsian)',
  min: U_EPS, max: 1 - U_EPS, step: 0.0005, value: u,
  format: (v) => `${v.toFixed(4)} → φ=${phaseOfU(v).toFixed(4)}`,
  onChange: (v) => { u = v; fullRebuild(false); },
});
slPhase.element.addEventListener('input', () => {
  u = slPhase.value;
  diagText.html(diagnosticsHTML());
});

function jumpToPhase(phiTarget: number, msg: string): void {
  const [loI, hiI] = trianglePhaseInterval(orders);
  u = (phiTarget - loI) / (hiI - loI);
  slPhase.set(u);
  critStatus.flash(msg, 3500, OK);
  fullRebuild(false);
}

panel.button({
  label: 'go to critical φ* (1213 parabolic)',
  onClick: () => {
    const phiC = findParabolicPhase(orders);
    if (phiC === null) {
      critStatus.flash('no parabolic phase of 1213 on (π, φmax) for these orders', 3000, WARN);
      return;
    }
    jumpToPhase(phiC, `φ* = ${phiC.toFixed(6)} — 1213 parabolic`);
  },
});

let targetN = 8;
panel.numberInput({
  label: '1213 target order n',
  value: targetN, min: 3, max: 999, step: 1,
  onChange: (v) => { targetN = Math.max(3, Math.round(v)); },
});
panel.button({
  label: 'go to 1213 elliptic of order n',
  onClick: () => {
    const r = findEllipticPhase(orders, targetN);
    if (r === null) {
      critStatus.flash(`order ${targetN} unreachable (splitting 2π/n not attained past φ*)`, 3500, WARN);
      return;
    }
    jumpToPhase(r.phase,
      `φ = ${r.phase.toFixed(6)} — 1213 elliptic, verified order ${r.order ?? '∞ (!)'}`);
  },
});
const critStatus = panel.text({ variant: 'meta' });

const diagText = panel.text({ variant: 'meta' });

panel.separator();

panel.slider({
  label: 'depth N',
  min: 6, max: 18, step: 1, value: depth,
  onChange: (v) => { depth = v; fullRebuild(false); },
});

panel.slider({
  label: 'ball radius',
  min: 0.0005, max: 0.05, step: 0.0005, value: DEFAULT_RADIUS,
  format: (v) => v.toFixed(4),
  event: 'input',
  onChange: (v) => { uniforms.uRadius.value = v; },
});

const DEFAULT_FOV = app.camera.fov;
panel.slider({
  label: 'fov',
  min: 0.5, max: 90, step: 0.5, value: DEFAULT_FOV,
  format: (v) => `${v}°`,
  event: 'input',
  onChange: (v) => { app.camera.fov = v; app.camera.updateProjectionMatrix(); },
});

panel.separator();

panel.select({
  label: 'view',
  options: [
    { value: 'sphere-stereo', label: 'S³ stereographic' },
    { value: 'heisenberg',    label: 'Heisenberg group' },
  ],
  value: DEFAULT_EMBEDDING,
  onChange: (v) => {
    currentEmbeddingName = v as EmbeddingName;
    currentEmbedding = EMBEDDINGS[currentEmbeddingName];
    rebuildMesh(true); updateUI();
  },
});

panel.select({
  label: 'color by',
  options: [
    { value: '0', label: 'grayscale' },
    { value: '1', label: 'last letter (ι₁ ι₂ ι₃)' },
    { value: '2', label: '2nd-to-last letter' },
    { value: '3', label: '3rd-to-last letter' },
  ],
  value: '0',
  onChange: (v) => { colorDepth = parseInt(v, 10); rebuildMesh(false); updateUI(); },
});

panel.separator();

panel.button({
  label: 'scan words ≤ 8 (elliptic alarm)',
  onClick: () => {
    const refl = triangleGroupReflections(orders, phi());
    const scan = scanEllipticWords(refl, 8);
    const fatal = scan.elliptic.filter((e) => e.order === null);
    const benign = scan.elliptic.length - fatal.length;
    const head = `${scan.loxodromic} lox / ${scan.parabolic} par / ` +
      `<span style="color:${OK}">${benign} finite-order</span> / ` +
      `<span style="color:${fatal.length ? BAD : OK}">${fatal.length} INFINITE-order elliptic</span>`;
    const rows = fatal.slice(0, 6).map((e) =>
      `<span style="color:${BAD}">⚠ ${formatWord(e.word, TRIANGLE_LABELS)} (f=${e.f.toExponential(1)})</span>`);
    scanText.html([head, ...rows].join('<br>'));
  },
});
const scanText = panel.text({ variant: 'meta' });

const modeEl = panel.text({ variant: 'mode' });
const statsEl = panel.text({ variant: 'stats' });

panel.button({
  label: 'screenshot',
  onClick: () => {
    app.screenshot(`su21-tri_${triSlug(orders, phi())}_${stats.kept}pts.png`);
  },
});

panel.separator();

panel.button({ label: 'copy view JSON for offline render', onClick: exportView });
const exportStatus = panel.text({ variant: 'meta' });

function updateUI(): void {
  diagText.html(diagnosticsHTML());
  statsEl.text(`${stats.totalWords.toLocaleString()} words, ${stats.kept.toLocaleString()} drawn`);
  modeEl.text(`view: ${currentEmbedding.pretty}`);
}

async function exportView(): Promise<void> {
  const bundle: TriViewPreset = {
    exampleId:    triSlug(orders, phi()),
    previewDepth: depth,
    colorScheme:  schemeForColorDepth(colorDepth).name,
    embedding:    currentEmbeddingName,
    orders,
    phase:        phi(),
    camera:       cameraSpecFromApp(app),
    viewport:     viewportFromApp(app),
  };
  await saveViewPreset('su21-tri', bundle, (msg, ok) =>
    exportStatus.flash(msg, 2500, ok ? OK : WARN));
}

// ─── Initial load ───────────────────────────────────────────────────────────

fullRebuild(true);
app.start();
