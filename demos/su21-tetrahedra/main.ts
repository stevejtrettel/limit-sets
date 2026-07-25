/**
 * SU(2,1) — ideal tetrahedra on ∂CH² (research instrument).
 *
 * Four ideal points, parameterized by moduli (A, ζx, ζy, v): base face
 * p₁p₂p₃ = idealTrianglePoints(A), p₄ = Heisenberg(ζ, v). Generators are the
 * 6 edge reflections (tetrahedron) or the 4 cyclic side reflections
 * (quadrilateral sub-alphabet).
 *
 * The instrument panel updates LIVE while dragging (it costs microseconds):
 *   - four face Cartan invariants vs A* (the Goldman–Parker subgroup filter);
 *   - the three opposite-edge pair classifications — crossing pairs show the
 *     angle in units of π (the π/n dial: a crossing pair forces an elliptic
 *     product, harmless only at finite order);
 *   - the Cartan cocycle sum (exact-zero sanity).
 * The orbit + mesh rebuild on slider release (or live at low depth via the
 * redraw select). "scan words" runs the elliptic alarm on demand.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { ControlPanel } from '@/app/ControlPanel';
import { createSphereMaterial } from '@/app/instancedSpheres';
import { buildLimitSetMesh } from '@/app/limitSetMesh';
import { cameraSpecFromApp, viewportFromApp, saveViewPreset } from '@/app/viewExport';

import type { GroupAction } from '@/core/group';
import { generateOrbit, totalNodes, type Orbit } from '@/core/orbit';
import type { SceneEmbedding } from '@/core/scene';
import { formatWord } from '@/core/seed';

import { schemeForColorDepth } from '@/render/colorScheme.ts';

import { stereographicEmbedding, heisenbergEmbedding } from '@/examples/complex-hyperbolic/embedding';
import { seedCH2 } from '@/examples/complex-hyperbolic/recipe';
import {
  classifyMirrorPair, cartanReport, scanEllipticWords,
} from '@/examples/complex-hyperbolic/diagnostics';
import {
  TETRA_EDGE_LABELS, QUAD_SIDE_LABELS, CYCLIC_SIDES,
  tetrahedronFromModuli, tetrahedronMirrors, tetrahedronReflections,
  tetrahedronAction, quadrilateralAction,
  type IdealTetrahedron,
} from '@/examples/complex-hyperbolic/tetrahedron';
import { tetraPaletteForScheme } from '@/examples/complex-hyperbolic/palette';
import {
  moduliSlug, type TetraModuli, type GeneratorSet, type EmbeddingName, type TetraViewPreset,
} from '@/examples/complex-hyperbolic/tetraViewPreset';

const app = new App({ antialias: true });
app.scene.background = new THREE.Color(0xffffff);
const { material, uniforms } = createSphereMaterial();

const DEFAULT_MODULI: TetraModuli = { A: 0.6, zx: 0.9, zy: 0.35, v: 0.8 };
const DEFAULT_DEPTH = 7;
const DEFAULT_RADIUS = 0.005;
const DEFAULT_EMBEDDING: EmbeddingName = 'sphere-stereo';
const NODE_BUDGET = 3_000_000;

const EMBEDDINGS: Record<EmbeddingName, SceneEmbedding> = {
  'sphere-stereo': stereographicEmbedding,
  'heisenberg':    heisenbergEmbedding,
};
const AUTOFIT_DIR: Record<EmbeddingName, readonly [number, number, number]> = {
  'sphere-stereo': [0.4, 0.4, 1],
  'heisenberg':    [0.7, 0.4, 0.6],
};

/** Opposite-edge pairs (indices into TETRA_EDGES): the discreteness gatekeepers.
 *  In quad mode the middle pair (the diagonals) is not among the generators. */
const OPP_PAIRS: readonly (readonly [number, number])[] = [[0, 5], [1, 4], [2, 3]];
const DIAGONAL_PAIR = 1;   // (ι₁₃, ι₂₄)

// ─── State ──────────────────────────────────────────────────────────────────

let moduli: TetraModuli = { ...DEFAULT_MODULI };
let gens: GeneratorSet = 'tetra';
let depth = DEFAULT_DEPTH;
let colorDepth = 0;
let liveRedraw = false;
let currentEmbeddingName: EmbeddingName = DEFAULT_EMBEDDING;
let currentEmbedding: SceneEmbedding = EMBEDDINGS[DEFAULT_EMBEDDING];

let pts!: IdealTetrahedron;
let currentAction: GroupAction | null = null;
let currentBasepoint: Float64Array | null = null;
let currentOrbit: Orbit | null = null;
let currentMesh: THREE.Mesh | null = null;
let currentSeedName = '';
let stats = { kept: 0, totalWords: 0, effDepth: DEFAULT_DEPTH };

const numGen = (): number => (gens === 'tetra' ? 6 : 4);
const labels = (): readonly string[] => (gens === 'tetra' ? TETRA_EDGE_LABELS : QUAD_SIDE_LABELS);

// ─── Diagnostics (cheap — runs on every drag tick) ──────────────────────────

const OK = '#9ec79e', WARN = '#d9a55c', BAD = '#d97c7c', DIM = '#8a8f98';
const esc = (s: string): string => s;

function diagnosticsHTML(): string {
  pts = tetrahedronFromModuli(moduli.A, [moduli.zx, moduli.zy], moduli.v);
  const rep = cartanReport(pts);
  const mirrors = tetrahedronMirrors(pts);
  const lines: string[] = [];
  lines.push('<b>faces</b> (GP filter, |A|/A*):');
  for (const t of rep.triples) {
    const name = `p${t.triple[0] + 1}p${t.triple[1] + 1}p${t.triple[2] + 1}`;
    const color = !t.withinGP ? BAD : t.ratioToCritical > 0.95 ? WARN : OK;
    const mark = !t.withinGP ? '✗' : t.ratioToCritical > 0.95 ? '⚠' : '✓';
    lines.push(
      `<span style="color:${color}">${mark} ${name}  A=${t.A.toFixed(4)}  ` +
      `${t.ratioToCritical.toFixed(3)}</span>`,
    );
  }
  lines.push('<b>opposite pairs</b>:');
  OPP_PAIRS.forEach(([a, b], k) => {
    const inactive = gens === 'quad' && k === DIAGONAL_PAIR;
    let cls;
    try { cls = classifyMirrorPair(mirrors[a], mirrors[b]); } catch { cls = null; }
    const label = `${TETRA_EDGE_LABELS[a]}·${TETRA_EDGE_LABELS[b]}`;
    if (cls === null) {
      lines.push(`<span style="color:${BAD}">${label}: degenerate</span>`);
      return;
    }
    let body: string, color: string;
    if (cls.type === 'crossing') {
      const overPi = cls.angle! / Math.PI;
      const n = 1 / overPi;
      body = `crossing  θ=${cls.angle!.toFixed(4)} = π/${n.toFixed(3)}`;
      const nearInt = Math.abs(n - Math.round(n)) < 0.01;
      color = inactive ? DIM : nearInt ? WARN : BAD;
    } else if (cls.type === 'ultraparallel') {
      body = `ultraparallel  ℓ=${cls.distance!.toFixed(4)}`;
      color = inactive ? DIM : OK;
    } else {
      body = 'asymptotic (extra tangency)';
      color = inactive ? DIM : WARN;
    }
    lines.push(`<span style="color:${color}">${esc(label)}: ${body}${inactive ? ' — diagonals, inactive' : ''}</span>`);
  });
  lines.push(`<span style="color:${DIM}">cocycle Σ± = ${rep.cocycleSum!.toExponential(1)}` +
    `   γ = ${esc(currentSeedName || '—')}</span>`);
  return lines.join('<br>');
}

// ─── Group / orbit / mesh rebuild (slider release) ──────────────────────────

function effectiveDepth(want: number): number {
  let d = want;
  while (d > 2 && totalNodes(numGen(), d) > NODE_BUDGET) d--;
  return d;
}

function rebuildGroup(): boolean {
  pts = tetrahedronFromModuli(moduli.A, [moduli.zx, moduli.zy], moduli.v);
  try {
    currentAction = gens === 'tetra' ? tetrahedronAction(pts) : quadrilateralAction(pts);
    const s = seedCH2(currentAction, labels());
    currentBasepoint = s.basepoint;
    currentSeedName = s.name;
    return true;
  } catch (e) {
    currentSeedName = '(no loxodromic seed found)';
    console.warn('[su21-tetra] seeding failed:', e);
    return false;
  }
}

function regenerateOrbit(): void {
  if (!currentAction || !currentBasepoint) return;
  const d = effectiveDepth(depth);
  const t0 = performance.now();
  currentOrbit = generateOrbit(currentAction, currentBasepoint, d);
  stats.effDepth = d;
  console.log(`[su21-tetra] BFS depth=${d} words=${currentOrbit.count} (${(performance.now() - t0).toFixed(0)}ms)`);
}

function rebuildMesh(autofit: boolean): void {
  if (!currentOrbit) return;
  const { mesh, kept } = buildLimitSetMesh({
    app, material, embedding: currentEmbedding, orbit: currentOrbit,
    colorDepth, categoryCount: numGen() + 1,
    paletteForScheme: tetraPaletteForScheme,
    previous: currentMesh, autofit, autofitDir: AUTOFIT_DIR[currentEmbeddingName],
  });
  currentMesh = mesh;
  stats = { ...stats, kept, totalWords: currentOrbit.count };
}

function fullRebuild(autofit: boolean): void {
  const ok = rebuildGroup();
  if (ok) { regenerateOrbit(); rebuildMesh(autofit); }
  updateUI();
}

// ─── Panel ──────────────────────────────────────────────────────────────────

const panel = new ControlPanel({ title: 'SU(2,1) — ideal tetrahedra' });

const selGens = panel.select({
  label: 'generators',
  options: [
    { value: 'tetra', label: 'tetrahedron (6 edge reflections)' },
    { value: 'quad',  label: 'quadrilateral (4 side reflections)' },
  ],
  value: 'tetra',
  onChange: (v) => { gens = v as GeneratorSet; fullRebuild(false); },
});

/** Moduli slider: live diagnostics on drag, full rebuild on release. */
function moduliSlider(
  label: string, min: number, max: number, step: number, value: number,
  assign: (v: number) => void,
): ReturnType<typeof panel.slider> {
  const sl = panel.slider({
    label, min, max, step, value,
    format: (v) => v.toFixed(3),
    onChange: (v) => { assign(v); fullRebuild(false); },   // release
  });
  sl.element.addEventListener('input', () => {
    assign(sl.value);
    diagText.html(diagnosticsHTML());
    if (liveRedraw && currentAction) {
      if (rebuildGroup()) {
        const save = depth; depth = Math.min(depth, 6);
        regenerateOrbit(); rebuildMesh(false);
        depth = save;
        updateUI();
      }
    }
  });
  return sl;
}

const slA  = moduliSlider('A (base face)', -1.40, 1.40, 0.005, DEFAULT_MODULI.A, (v) => { moduli.A = v; });
const slZx = moduliSlider('p₄ ζx', -2.5, 2.5, 0.01, DEFAULT_MODULI.zx, (v) => { moduli.zx = v; });
const slZy = moduliSlider('p₄ ζy', -2.5, 2.5, 0.01, DEFAULT_MODULI.zy, (v) => { moduli.zy = v; });
const slV  = moduliSlider('p₄ v',  -4.0, 4.0, 0.01, DEFAULT_MODULI.v,  (v) => { moduli.v = v; });

const diagText = panel.text({ variant: 'meta' });

panel.separator();

const slDepth = panel.slider({
  label: 'depth N',
  min: 4, max: 12, step: 1, value: depth,
  onChange: (v) => { depth = v; regenerateOrbit(); rebuildMesh(false); updateUI(); },
});

panel.select({
  label: 'redraw',
  options: [
    { value: 'release', label: 'on slider release' },
    { value: 'live',    label: 'live while dragging (depth ≤ 6)' },
  ],
  value: 'release',
  onChange: (v) => { liveRedraw = v === 'live'; },
});

panel.slider({
  label: 'ball radius',
  min: 0.0005, max: 0.05, step: 0.0005, value: DEFAULT_RADIUS,
  format: (v) => v.toFixed(4),
  event: 'input',
  onChange: (v) => { uniforms.uRadius.value = v; },
});

const DEFAULT_FOV = app.camera.fov;
const slFov = panel.slider({
  label: 'fov',
  min: 0.5, max: 90, step: 0.5, value: DEFAULT_FOV,
  format: (v) => `${v}°`,
  event: 'input',
  onChange: (v) => { app.camera.fov = v; app.camera.updateProjectionMatrix(); },
});

panel.separator();

const selEmbedding = panel.select({
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
    { value: '1', label: 'last letter (opposite pairs share hue)' },
    { value: '2', label: '2nd-to-last letter' },
    { value: '3', label: '3rd-to-last letter' },
  ],
  value: '0',
  onChange: (v) => { colorDepth = parseInt(v, 10); rebuildMesh(false); updateUI(); },
});

panel.separator();

panel.button({
  label: 'scan words ≤ 5 (elliptic alarm)',
  onClick: () => {
    const all = tetrahedronReflections(pts);
    const refl = gens === 'tetra' ? all : CYCLIC_SIDES.map((c) => all[c]);
    const scan = scanEllipticWords(refl, 5);
    const head = `${scan.loxodromic} lox / ${scan.parabolic} par / ` +
      `<span style="color:${scan.elliptic.length ? BAD : OK}">${scan.elliptic.length} elliptic</span>`;
    const rows = scan.elliptic.slice(0, 8)
      .map((e) => `<span style="color:${BAD}">⚠ ${formatWord(e.word, labels())} (f=${e.f.toExponential(1)})</span>`);
    const more = scan.elliptic.length > 8 ? [`… +${scan.elliptic.length - 8} more`] : [];
    scanText.html([head, ...rows, ...more].join('<br>'));
  },
});
const scanText = panel.text({ variant: 'meta' });

const modeEl = panel.text({ variant: 'mode' });
const statsEl = panel.text({ variant: 'stats' });

panel.button({
  label: 'reset',
  onClick: () => {
    moduli = { ...DEFAULT_MODULI };
    slA.set(moduli.A); slZx.set(moduli.zx); slZy.set(moduli.zy); slV.set(moduli.v);
    depth = DEFAULT_DEPTH; slDepth.set(depth);
    selGens.set('tetra'); gens = 'tetra';
    selEmbedding.set(DEFAULT_EMBEDDING);
    currentEmbeddingName = DEFAULT_EMBEDDING;
    currentEmbedding = EMBEDDINGS[DEFAULT_EMBEDDING];
    slFov.set(DEFAULT_FOV);
    app.camera.fov = DEFAULT_FOV; app.camera.updateProjectionMatrix();
    fullRebuild(true);
  },
});

panel.button({
  label: 'screenshot',
  onClick: () => {
    app.screenshot(`su21-tetra_${moduliSlug(moduli, gens)}_${stats.kept}pts.png`);
  },
});

panel.separator();

panel.button({ label: 'copy view JSON for offline render', onClick: exportView });
const exportStatus = panel.text({ variant: 'meta' });

function updateUI(): void {
  diagText.html(diagnosticsHTML());
  statsEl.text(
    `${stats.totalWords.toLocaleString()} words (depth ${stats.effDepth}), ` +
    `${stats.kept.toLocaleString()} drawn`,
  );
  modeEl.text(`view: ${currentEmbedding.pretty}`);
}

async function exportView(): Promise<void> {
  const bundle: TetraViewPreset = {
    exampleId:    moduliSlug(moduli, gens),
    previewDepth: depth,
    colorScheme:  schemeForColorDepth(colorDepth, numGen() + 1).name,
    embedding:    currentEmbeddingName,
    moduli:       { ...moduli },
    generators:   gens,
    camera:       cameraSpecFromApp(app),
    viewport:     viewportFromApp(app),
  };
  await saveViewPreset('su21-tetra', bundle, (msg, ok) =>
    exportStatus.flash(msg, 2500, ok ? '#9ec79e' : '#d9a55c'));
}

// ─── Initial load ───────────────────────────────────────────────────────────

fullRebuild(true);
app.start();
