/**
 * James–Marit demo — SL(4,R) limit sets in RP³.
 *
 * The 4×4 representation is built live from three pieces:
 *   1. ρ : F₂ → SL(2, R)            (two 2×2 matrices typed into the panel)
 *   2. φ : F₂ → R                   (k_a · ℓ(a) and k_b · ℓ(b), scaled by s)
 *   3. v : F₂ → R³ cocycle          (v_a, v_b in the kernel of v_{[a,b]} = 0)
 * The third piece lives in a generically 3-dim affine slice of R⁶;
 * three α-sliders move us around inside it.
 *
 * Fabi's affine chart (parameterised by t, scale) projects RP³ → R³ for
 * display.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { ControlPanel } from '@/app/ControlPanel';
import { createSphereMaterial, makeInstancedSpheres } from '@/app/instancedSpheres';
import { autofitCamera } from '@/app/autofit';

import type { SL4RExample } from '@/sl4r/types';
import {
  makeMat4Action, mat4Mul, mat4Inverse, type Mat4R,
} from '@/sl4r/action';
import { paletteForScheme } from '@/sl4r/palettes';
import type { JMViewPreset, JMRenderMode, Mat4Json } from './viewPreset';
import type { GroupAction } from '@/core/group';
import {
  computeProximalBasepoint, generateOrbit, type Orbit,
} from '@/core/orbit';
import {
  type ChartEmbedding,
  makeChartFromData,
} from '@/core/chart';
import { schemeForColorDepth } from '@/render/colorScheme';
import { buildOrbitInstances } from '@/render/orbitInstances';

import {
  type HyperbolicRep, type Mat2R,
  trace2, det2, translationLength, mul2, inv2, DEFAULT_REP,
  verifyPuncturedTorusRep,
} from './hypRep';
import {
  type MarkovTriple,
  markovTripleFromXY, matricesFromMarkov, verifyRep, minYGivenX,
} from './teichmuller';
import {
  type Cohomology, makeCohomology, defaultMultipliers,
  DEFAULT_S,
} from './cohomology';
import {
  type Vec6, cocycleSpace, combineBasis,
} from './cocycle';
import { buildExample, scaledBlocks, type ScaledBlocks } from './repBuilder';
import { makeFabiChart, FABI_DEFAULT_T, FABI_DEFAULT_SCALE } from './fabiChart';
import { diagonalizerForSym2A, rowMul3, block4 } from './diagonalize';
import { inv3, mul3, sym2, type Mat3R } from './symSquare';

const app = new App({ antialias: true });
app.scene.background = new THREE.Color(0xffffff);

const { material, uniforms } = createSphereMaterial(0.01);

const DEFAULT_DEPTH  = 8;     // lower than sl4r-limit-sets because we regen on every slider tick
const DEFAULT_RADIUS = 0.01;  // works at the friend's defaults t=-100, scale=300 (15-85 bbox ~5)

// ─── State ──────────────────────────────────────────────────────────────────

/**
 * Representation mode. Two options for picking the ρ : F₂ → SL(2,R)
 * underlying the SL(4,R) rep:
 *   - 'modular-torus': explicit integer matrices DEFAULT_REP from hypRep.ts,
 *                      the canonical (3,3,3) modular-torus generators.
 *   - 'teichmuller':   user-chosen (x, y) on the Teichmüller component,
 *                      triple = markovTripleFromXY(x, y) (z derived); the
 *                      resulting matrices are NOT integer-valued in general.
 * Default is the modular torus.
 */
type RepMode = 'modular-torus' | 'teichmuller';
let repMode: RepMode = 'modular-torus';

// (x, y) live on the Teichmüller component of the Markov surface; z is
// derived. Used only when repMode === 'teichmuller'. Sliders default to
// (3, 3), which under markovTripleFromXY yields (3, 3, 6) — a Vieta-
// equivalent marking of the same modular-torus point.
let x = 3;
let y = 3;

// `triple` and `rep` reflect the CURRENT mode. Initial = modular torus.
function tripleFromRep(r: HyperbolicRep): MarkovTriple {
  return [trace2(r.a), trace2(r.b), trace2(mul2(r.a, r.b))];
}
let rep: HyperbolicRep = DEFAULT_REP;
let triple: MarkovTriple = tripleFromRep(rep);
// kA, kB are derived inside recomputeBasis() from the current rep, so
// they track ρ changes; this is just the initial display value.
let { kA, kB } = defaultMultipliers(rep);
let sCoh = DEFAULT_S;
let alphas: [number, number, number] = [0, 0, 0];

let currentCoho:    Cohomology;
let currentBlocks:  ScaledBlocks;
let currentBasis:   readonly Vec6[];
let currentRank:    number;
let currentV:       Vec6;
let currentExample: SL4RExample;
let currentAction:  GroupAction;
let currentBasepoint: Float64Array;
let currentOrbit:   Orbit;
let currentProj:    ChartEmbedding;
let currentMesh: THREE.Mesh | null = null;
// P diagonalizes sym²(ρ(a)); columns ordered (eigval=1, λ₊², λ₋²). Only
// depends on ρ(a), so recomputed in recomputeBasis() alongside the cocycle.
let currentP:    Mat3R;
let currentPinv: Mat3R;

let depth = DEFAULT_DEPTH;
let colorDepth = 0;
let renderMode: JMRenderMode = 'points';
let fabiT = FABI_DEFAULT_T;
let fabiScale = FABI_DEFAULT_SCALE;
let stats = { kept: 0, totalWords: 0 };
let lambdaMax = NaN;
let drift = NaN;

// ─── Recompute pipeline ────────────────────────────────────────────────────

function recomputeBasis(): void {
  // Re-derive (kA, kB) so they track ℓ(a) when ρ moves around the
  // Teichmüller component. kA = ℓ(a), kB = 0 by the demo spec.
  const m = defaultMultipliers(rep);
  kA = m.kA;
  kB = m.kB;
  currentCoho = makeCohomology(kA, kB, sCoh);
  currentBlocks = scaledBlocks(rep, currentCoho);
  const space = cocycleSpace(currentBlocks.A, currentBlocks.B);
  currentBasis = space.basis;
  currentRank  = space.rank;
  currentP    = diagonalizerForSym2A(rep.a);
  currentPinv = inv3(currentP);
}

function rebuildGenerators(): void {
  currentV = combineBasis(currentBasis, alphas);
  currentExample = buildExample(rep, currentCoho, currentV, currentBlocks);
  currentAction  = makeMat4Action(currentExample.generators, { involutions: false });
  const r = computeProximalBasepoint(
    currentAction, currentExample.gamma, currentExample.powerIter);
  currentBasepoint = r.basepoint;
  lambdaMax = r.lambdaMax;
  drift     = r.drift;
}

function regenerateOrbit(N: number): void {
  currentOrbit = generateOrbit(currentAction, currentBasepoint, N);
}

function rebuildMesh(autofit: boolean): void {
  const scheme = schemeForColorDepth(colorDepth);
  const palette = paletteForScheme(scheme.name);
  const { aPos, aColor, kept } = buildOrbitInstances(
    currentProj, currentOrbit, scheme, palette,
  );
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

function rebuildFabiChart(): void {
  const c = makeFabiChart(fabiT, fabiScale);
  currentProj = makeChartFromData({
    stateDim: 4,
    denom: [...c.denom],
    rows: [[...c.rowX], [...c.rowY], [...c.rowZ]],
    label: c.id,
    pretty: c.pretty ?? c.label,
  });
}

/** Full pipeline: rep → φ → cocycle basis → v → SL4Rexample → orbit → mesh. */
function repipeline(autofit: boolean): void {
  recomputeBasis();
  rebuildGenerators();
  regenerateOrbit(depth);
  rebuildMesh(autofit);
  updateUI();
}

/** Light pipeline: only the α coords changed; basis is reused. */
function alphaRetrigger(): void {
  rebuildGenerators();
  regenerateOrbit(depth);
  rebuildMesh(false);
  updateUI();
}

// When the cocycle basis changes (rep or φ), reset α to (0, 0, 0) — the
// trivial cocycle v = 0, basis-independent. Without this reset, the same
// numerical α refers silently to a different v after the basis changes.
function resetAlphasToZero(): void {
  alphas = [0, 0, 0];
  slA1.set(0); slA2.set(0); slA3.set(0);
}

// ─── HUD ────────────────────────────────────────────────────────────────────

const panel = new ControlPanel({ title: 'James–Marit — SL(4,R) limit sets in RP³' });

// Always-visible status. Stays above the collapsible folders so you can
// see #words / kept / view label / |λ_max| regardless of what's open.
const modeEl  = panel.text({ variant: 'mode' });
const statsEl = panel.text({ variant: 'stats' });

// ── Rep mode — primary toggle: modular torus vs Teichmüller (x, y) ────────
// applyRepMode references slX/slY/resetAlphasToZero, all defined later in
// this file. Closures resolve at call time, and the select's onChange only
// fires after init, so the forward references are safe.
const selMode = panel.select({
  label: 'rep',
  options: [
    { value: 'modular-torus', label: 'modular torus' },
    { value: 'teichmuller',   label: 'Teichmüller (x, y sliders)' },
  ],
  value: repMode,
  onChange: (v) => { repMode = v as RepMode; applyRepMode(); },
});
void selMode; // not used after construction (no programmatic resets touch it)

function applyRepMode(): void {
  if (repMode === 'modular-torus') {
    rep = DEFAULT_REP;
  } else {
    const m = matricesFromMarkov(markovTripleFromXY(x, y));
    rep = { a: m.A, b: m.B };
  }
  triple = tripleFromRep(rep);
  slX.element.disabled = (repMode === 'modular-torus');
  slY.element.disabled = (repMode === 'modular-torus');
  resetAlphasToZero();
  repipeline(false);
}

// ── Cocycle (α coords) — primary interaction, open by default ─────────────
const cocyFolder = panel.folder('Cocycle (α coords)', { open: true });
const slA1 = cocyFolder.slider({
  label: 'α₁',
  min: -50, max: 50, step: 0.001, value: alphas[0],
  format: (v) => v.toFixed(3),
  onChange: (v) => { alphas = [v, alphas[1], alphas[2]]; alphaRetrigger(); },
});
const slA2 = cocyFolder.slider({
  label: 'α₂',
  min: -50, max: 50, step: 0.001, value: alphas[1],
  format: (v) => v.toFixed(3),
  onChange: (v) => { alphas = [alphas[0], v, alphas[2]]; alphaRetrigger(); },
});
const slA3 = cocyFolder.slider({
  label: 'α₃',
  min: -50, max: 50, step: 0.001, value: alphas[2],
  format: (v) => v.toFixed(3),
  onChange: (v) => { alphas = [alphas[0], alphas[1], v]; alphaRetrigger(); },
});
const cocyMeta = cocyFolder.text({ variant: 'meta' });

// ── Teichmüller (x, y on the Markov surface; z derived) ────────────────────
const teichFolder = panel.folder('Teichmüller (trace coords)');

function onTeichChange(): void {
  triple = markovTripleFromXY(x, y);
  const m = matricesFromMarkov(triple);
  rep = { a: m.A, b: m.B };
  resetAlphasToZero();
  repipeline(false);
}

const slX = teichFolder.slider({
  label: 'x = tr(A)',
  min: 2.1, max: 10, step: 0.001, value: x,
  format: (v) => v.toFixed(3),
  onChange: (v) => {
    x = v;
    const yMin = minYGivenX(x);
    if (y < yMin) {
      y = yMin;
      slY.set(y);
    }
    onTeichChange();
  },
});
const slY = teichFolder.slider({
  label: 'y = tr(B)',
  min: 2.1, max: 10, step: 0.001, value: y,
  format: (v) => v.toFixed(3),
  onChange: (v) => {
    y = v;
    const xMin = minYGivenX(y); // symmetric: minY(y) is the analogous minX(y)
    if (x < xMin) {
      x = xMin;
      slX.set(x);
    }
    onTeichChange();
  },
});
const teichMeta = teichFolder.text({ variant: 'meta' });

// ── Cohomology (s) — closed; k_a, k_b live in cohomology.ts defaults ──────
const cohFolder = panel.folder('Cohomology (s)');
cohFolder.slider({
  label: 's (cohom scale)',
  min: 0, max: 1, step: 0.001, value: sCoh,
  format: (v) => v.toFixed(3),
  onChange: (v) => { sCoh = v; resetAlphasToZero(); repipeline(false); },
});
const cohMeta = cohFolder.text({ variant: 'meta' });

// ── Representation (ρ) — closed; matrices are hardcoded in hypRep.ts ──────
const repFolder = panel.folder('Representation (ρ info)');
const repMeta = repFolder.text({ variant: 'meta' });

// ── Chart (Fabi projection) ────────────────────────────────────────────────
const chartFolder = panel.folder('Chart (Fabi projection)');
const slFabiT = chartFolder.slider({
  label: 'Fabi t',
  min: -200, max: 200, step: 0.01, value: fabiT,
  format: (v) => v.toFixed(2),
  event: 'input',
  onChange: (v) => { fabiT = v; rebuildFabiChart(); rebuildMesh(false); updateUI(); },
});
const slFabiScale = chartFolder.slider({
  label: 'Fabi scale',
  min: 1, max: 600, step: 1, value: fabiScale,
  format: (v) => v.toFixed(0),
  event: 'input',
  onChange: (v) => { fabiScale = v; rebuildFabiChart(); rebuildMesh(false); updateUI(); },
});

// ── View (depth / camera) ──────────────────────────────────────────────────
const viewFolder = panel.folder('View');
const slDepth = viewFolder.slider({
  label: 'depth N',
  min: 4, max: 14, step: 1, value: depth,
  onChange: (v) => { depth = v; regenerateOrbit(v); rebuildMesh(false); updateUI(); },
});
viewFolder.slider({
  label: 'ball radius',
  min: 0.001, max: 0.1, step: 0.001, value: DEFAULT_RADIUS,
  format: (v) => v.toFixed(3),
  event: 'input',
  onChange: (v) => { uniforms.uRadius.value = v; },
});
const DEFAULT_FOV = app.camera.fov;
const slFov = viewFolder.slider({
  label: 'fov',
  min: 0.5, max: 90, step: 0.5, value: DEFAULT_FOV,
  format: (v) => `${v}°`,
  event: 'input',
  onChange: (v) => {
    app.camera.fov = v;
    app.camera.updateProjectionMatrix();
  },
});

// ── Color ──────────────────────────────────────────────────────────────────
const colorFolder = panel.folder('Color');
colorFolder.select({
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

// ── Offline render mode ────────────────────────────────────────────────────
// Affects the offline PNG render only (the live preview here always shows
// orbit points). Rays-to-e₄ are an invariant subset of the limit set when
// s = 1; at s ≠ 1 they're a decoration.
const offlineFolder = panel.folder('Offline render');
offlineFolder.select({
  label: 'render mode',
  options: [
    { value: 'points', label: 'points only' },
    { value: 'rays',   label: 'rays to e₄' },
    { value: 'both',   label: 'points + rays' },
  ],
  value: renderMode,
  onChange: (v) => { renderMode = v as JMRenderMode; },
});
offlineFolder.text({
  variant: 'meta',
  initial: 'affects the offline render only; live preview always shows points.',
});

// ── Actions (reset / screenshot / export) ──────────────────────────────────
const actionsFolder = panel.folder('Actions');
actionsFolder.button({
  label: 'reset',
  onClick: () => {
    depth = DEFAULT_DEPTH; slDepth.set(DEFAULT_DEPTH);
    slFov.set(DEFAULT_FOV);
    app.camera.fov = DEFAULT_FOV;
    app.camera.updateProjectionMatrix();
    fabiT = FABI_DEFAULT_T; fabiScale = FABI_DEFAULT_SCALE;
    slFabiT.set(FABI_DEFAULT_T); slFabiScale.set(FABI_DEFAULT_SCALE);
    rebuildFabiChart();
    rebuildMesh(true);
    updateUI();
  },
});
actionsFolder.button({
  label: 'screenshot',
  onClick: () => {
    app.screenshot(`james-marit_${stats.kept}pts_${shotTimestamp()}.png`);
  },
});
actionsFolder.button({
  label: 'screenshot + metadata',
  onClick: () => {
    screenshotWithMetadata(`james-marit_meta_${stats.kept}pts_${shotTimestamp()}.png`);
  },
});
actionsFolder.button({
  label: 'log A, B, [A,B] to console',
  onClick: () => logCurrentRep(),
});
actionsFolder.button({
  label: 'copy view JSON for offline render',
  onClick: exportView,
});
const exportStatus = actionsFolder.text({ variant: 'meta' });

// ─── UI helpers ────────────────────────────────────────────────────────────

function shotTimestamp(): string {
  return new Date().toISOString().replace(/[-:]|\..*/g, '').replace('T', '-');
}

/**
 * Print the live SL(4,R) generators A, B and their commutator
 * [A, B] = A·B·A⁻¹·B⁻¹ to the browser console, for sanity-checking that
 * the 4×4 representation at the currently selected (mode, x, y, s, α)
 * really matches what you expect. The SL(2,R) ρ underneath is also
 * printed for reference.
 *
 * For a valid Hitchin / James-Marit rep, the cocycle constraint
 * v_{[a,b]} = 0 forces [A, B]'s bottom row to be (0, 0, 0, 1), making
 * the commutator block-diagonal (3×3 SL(3) commutator on top, scalar
 * 1 below). Inspect the printed [A, B] to see how close we are.
 */
function logCurrentRep(): void {
  const modeLabel = repMode === 'modular-torus'
    ? 'modular torus'
    : `Teichmüller (x=${x}, y=${y})`;
  console.log(
    `[james-marit] rep at ${modeLabel}, s=${sCoh}, α=(${alphas.join(', ')})`,
  );

  // SL(2,R) ρ, for reference. Default Number.toString() gives full IEEE 754
  // double precision (shortest round-trippable representation, ~15–17 digits).
  const fmt2 = (m: Mat2R): string =>
    `[[${m[0][0]}, ${m[0][1]}], [${m[1][0]}, ${m[1][1]}]]`;
  const aB = rep.a, bB = rep.b;
  const rhoComm = mul2(mul2(mul2(aB, bB), inv2(aB)), inv2(bB));
  console.log(`  ρ(a) = ${fmt2(aB)},   tr = ${trace2(aB)}, det = ${det2(aB)}`);
  console.log(`  ρ(b) = ${fmt2(bB)},   tr = ${trace2(bB)}, det = ${det2(bB)}`);
  console.log(`  ρ([a,b]) trace = ${trace2(rhoComm)} (target −2)`);

  // Punctured-torus rep check: SL(2,R), both hyperbolic, parabolic commutator,
  // intersecting axes in H². Same checks that gate DEFAULT_REP at import.
  const ptCheck = verifyPuncturedTorusRep(rep);
  if (ptCheck.ok) {
    console.log(`  ✓ valid punctured-torus rep (intersecting translation axes, parabolic commutator)`);
  } else {
    console.warn(`  ✗ NOT a valid punctured-torus rep:`);
    for (const r of ptCheck.reasons) console.warn(`      - ${r}`);
  }

  // SL(4,R) generators built from ρ + φ + α-cocycle.
  const fmt4 = (m: Mat4R): string => {
    const fmtRow = (r: readonly number[]): string =>
      `[${r.join(', ')}]`;
    return `\n    ${m.map(fmtRow).join(',\n    ')}`;
  };
  const A = currentExample.generators[0] as Mat4R;
  const B = currentExample.generators[1] as Mat4R;
  const trace4 = (m: Mat4R) => m[0][0] + m[1][1] + m[2][2] + m[3][3];
  console.log(`  A (4×4) = ${fmt4(A)}`);
  console.log(`    tr A = ${trace4(A)}`);
  console.log(`  B (4×4) = ${fmt4(B)}`);
  console.log(`    tr B = ${trace4(B)}`);

  // Un-twisted 3×3 diagonalization: P⁻¹·sym²(ρ(a))·P = diag(λ₊², 1, λ₋²)
  // regardless of s. The φ-twist in the actual 4×4 block scales this by
  // exp(-φ(a)) = exp(-s·ℓ(a)); at s=1 the (1,1) entry becomes 1 exactly.
  const fmt3 = (m: Mat3R): string => {
    const fmtRow = (r: readonly number[]): string => `[${r.join(', ')}]`;
    return `\n    ${m.map(fmtRow).join(',\n    ')}`;
  };
  const sym2RhoA = sym2(rep.a);
  const sym2Diag = mul3(currentPinv, mul3(sym2RhoA, currentP));
  console.log(`  P⁻¹·sym²(ρ(a))·P = ${fmt3(sym2Diag)}  (target diag(λ₊², 1, λ₋²))`);

  // Conjugate of the 4×4 A by P_4 = blockDiag(P, 1). Upper-left 3×3 is
  // exp(-φ(a))·diag(λ₊², 1, λ₋²); bottom row is v(a)·P. At s=1 the (1,1)
  // entry equals 1 exactly (Anosov/proximal normalization).
  const P4    = block4(currentP,    1) as Mat4R;
  const P4inv = block4(currentPinv, 1) as Mat4R;
  const Aconj = mat4Mul(mat4Mul(P4inv, A), P4);
  console.log(`  P_4⁻¹·A·P_4 = ${fmt4(Aconj)}`);
  console.log(`    tr (P_4⁻¹·A·P_4) = ${trace4(Aconj)}`);
  const comm4 = mat4Mul(mat4Mul(mat4Mul(A, B), mat4Inverse(A)), mat4Inverse(B));
  console.log(`  [A, B] = A·B·A⁻¹·B⁻¹ = ${fmt4(comm4)}`);
  console.log(
    `    tr[A, B] = ${trace4(comm4)}; ` +
    `bottom row = [${comm4[3].join(', ')}] ` +
    `(target [0, 0, 0, 1])`,
  );

  // [A, B]^10 — naïve repeated multiplication (10 mat4 mults). At a valid
  // cocycle (bottom row exactly (0,0,0,1)), this is block-diagonal with the
  // 3×3 SL(3) commutator's 10th power on top and 1 below.
  let pow = comm4;
  for (let i = 1; i < 10; i++) pow = mat4Mul(pow, comm4);
  console.log(`  [A, B]^10 = ${fmt4(pow)}`);
  console.log(
    `    tr [A, B]^10 = ${trace4(pow)}; ` +
    `bottom row = [${pow[3].join(', ')}]`,
  );
}

/**
 * Save a screenshot with the parameter metadata (s, cocycle (a,b,c) and
 * (x,y,z), full 4×4 A and B matrices) overlaid in the upper-right corner
 * in a small monospace typeface, so the image is self-documenting.
 *
 * Values are printed at full IEEE 754 double precision via Number.toString.
 * Matrix entries are right-padded to a fixed width per entry so columns
 * align in the monospace font.
 */
function screenshotWithMetadata(filename: string): void {
  // Make sure the latest frame is on the canvas before we copy pixels.
  app.renderManager.renderer.render(app.scene, app.camera);
  const src = app.renderManager.renderer.domElement;
  const w = src.width, h = src.height;

  const off = document.createElement('canvas');
  off.width = w; off.height = h;
  const ctx = off.getContext('2d');
  if (!ctx) {
    console.warn('[james-marit] screenshot+metadata: no 2d context, falling back to raw');
    app.screenshot(filename);
    return;
  }
  ctx.drawImage(src, 0, 0);

  // Build the text block.
  const A = currentExample.generators[0] as Mat4R;
  const B = currentExample.generators[1] as Mat4R;
  // Per-entry width across both matrices, so A and B align column-wise.
  const allEntries = ([] as number[]).concat(...A, ...B);
  const cellWidth = Math.max(
    ...allEntries.map((v) => v.toString().length),
  );
  const cell = (v: number): string => v.toString().padStart(cellWidth);
  const rowStr = (r: readonly number[]): string =>
    `[ ${r.map(cell).join('  ')} ]`;
  const lines: string[] = [
    `s = ${sCoh}`,
    `(a, b, c) = (${currentV[0]}, ${currentV[1]}, ${currentV[2]})`,
    `(x, y, z) = (${currentV[3]}, ${currentV[4]}, ${currentV[5]})`,
    ``,
    `A =`,
    ...A.map(rowStr),
    ``,
    `B =`,
    ...B.map(rowStr),
  ];

  // Layout: small monospace, upper-right with a translucent white background
  // for legibility over busy fractal images.
  const fontSize = 13;
  const lineHeight = fontSize + 4;
  const pad = 12;
  ctx.font = `${fontSize}px ui-monospace, "SF Mono", Menlo, Consolas, monospace`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  let maxW = 0;
  for (const line of lines) {
    const m = ctx.measureText(line);
    if (m.width > maxW) maxW = m.width;
  }
  const boxX = w - maxW - pad - 8;
  const boxY = pad - 4;
  const boxW = maxW + 16;
  const boxH = lines.length * lineHeight + 8;

  ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
  ctx.fillRect(boxX, boxY, boxW, boxH);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.92)';
  let y = pad;
  for (const line of lines) {
    ctx.fillText(line, w - maxW - pad, y);
    y += lineHeight;
  }

  off.toBlob((blob) => {
    if (!blob) {
      console.warn('[james-marit] screenshot+metadata: toBlob failed');
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  });
}

function fmtLen(m: Mat2R): string {
  const t = Math.abs(trace2(m));
  if (t <= 2) return '— (elliptic/parabolic)';
  return translationLength(m).toFixed(4);
}

function updateUI(): void {
  const v = verifyRep(rep.a, rep.b);
  const modeLabel = repMode === 'modular-torus'
    ? 'modular torus'
    : 'Teichmüller (x, y)';
  teichMeta.html(
    `<b>${modeLabel}</b><br>` +
    `(tr A, tr B, tr AB) = (${triple[0].toFixed(4)}, ${triple[1].toFixed(4)}, ${triple[2].toFixed(4)})<br>` +
    `tr[A,B] = ${v.trCommutator.toFixed(4)} (target −2)<br>` +
    `det A = ${v.detA.toFixed(4)}   det B = ${v.detB.toFixed(4)}`,
  );
  repMeta.html(
    `tr(a) = ${trace2(rep.a).toFixed(4)}   det(a) = ${det2(rep.a).toFixed(4)}<br>` +
    `tr(b) = ${trace2(rep.b).toFixed(4)}   det(b) = ${det2(rep.b).toFixed(4)}<br>` +
    `ℓ(a) = ${fmtLen(rep.a)}<br>` +
    `ℓ(b) = ${fmtLen(rep.b)}`,
  );
  cohMeta.html(
    `kA = ${kA.toFixed(4)} (= ℓ(a))   kB = ${kB.toFixed(4)}<br>` +
    `φ(a) = s·kA = ${currentCoho.phiA.toFixed(4)}<br>` +
    `φ(b) = s·kB = ${currentCoho.phiB.toFixed(4)}`,
  );
  const lambdaStr = Number.isFinite(lambdaMax)
    ? `|λ_max(γ=B)| = ${lambdaMax.toFixed(3)}, drift = ${drift.toExponential(2)}`
    : `|λ_max(γ=B)| = NaN (γ not loxodromic for current rep)`;
  const fmt = (x: number): string => x.toFixed(4);
  // Bottom row of the 4×4 commutator [A, B] = A·B·A⁻¹·B⁻¹ at the current
  // (rep, φ, α). For a valid cocycle (v_[a,b] = 0) the first 3 entries are
  // 0 and the 4th is 1 — drift from those tells you how well the cocycle
  // constraint is being satisfied numerically.
  const A4 = currentExample.generators[0] as Mat4R;
  const B4 = currentExample.generators[1] as Mat4R;
  const comm4 = mat4Mul(mat4Mul(mat4Mul(A4, B4), mat4Inverse(A4)), mat4Inverse(B4));
  const bottom = comm4[3];
  // v(a)·P and v(b)·P, where P diagonalizes sym²(ρ(a)) with columns
  // (λ₊², 1, λ₋²). v(a)·P is the bottom row of the upper-left 3×3 block of
  // P_4⁻¹·A·P_4; v(b)·P is the same row of P_4⁻¹·B·P_4 (with P_4 =
  // blockDiag(P, 1)) — re-expressing both cocycle vectors in the eigenbasis
  // of A.
  const vAP = rowMul3([currentV[0], currentV[1], currentV[2]], currentP);
  const vBP = rowMul3([currentV[3], currentV[4], currentV[5]], currentP);
  cocyMeta.html(
    `cocycle rank: ${currentRank} (nullity ${currentBasis.length})<br>` +
    `(a,b,c) = (${fmt(currentV[0])}, ${fmt(currentV[1])}, ${fmt(currentV[2])})<br>` +
    `(a,b,c)·P = (${fmt(vAP[0])}, ${fmt(vAP[1])}, ${fmt(vAP[2])})<br>` +
    `(x,y,z) = (${fmt(currentV[3])}, ${fmt(currentV[4])}, ${fmt(currentV[5])})<br>` +
    `(x,y,z)·P = (${fmt(vBP[0])}, ${fmt(vBP[1])}, ${fmt(vBP[2])})<br>` +
    `v_[A,B] = (${bottom[0]}, ${bottom[1]}, ${bottom[2]}, ${bottom[3]})<br>` +
    `${lambdaStr}`,
  );
  statsEl.text(
    `${stats.totalWords.toLocaleString()} words, ` +
    `${stats.kept.toLocaleString()} drawn`,
  );
  modeEl.text(`view: ${currentProj.pretty}`);
}

// ─── View export ────────────────────────────────────────────────────────────

async function exportView(): Promise<void> {
  const cam = app.camera as THREE.PerspectiveCamera;
  const tgt = app.controls.target;
  const canvas = app.renderManager.renderer.domElement;
  const bundle: JMViewPreset = {
    exampleId:    'james-marit',
    previewDepth: depth,
    colorScheme:  schemeForColorDepth(colorDepth).name,
    renderMode,
    generators:   currentExample.generators.map(
      (m) => m.map((r) => [...r]) as unknown as Mat4Json,
    ),
    gamma:        [...currentExample.gamma],
    gammaName:    currentExample.gammaName,
    powerIter:    currentExample.powerIter,
    involutions:  currentExample.involutions,
    params: {
      repMode,
      x,
      y,
      s: sCoh,
      alphas: [alphas[0], alphas[1], alphas[2]],
    },
    projection: {
      denom: Array.from(currentProj.denom),
      rowX:  Array.from(currentProj.rows[0]),
      rowY:  Array.from(currentProj.rows[1]),
      rowZ:  Array.from(currentProj.rows[2]),
      label: currentProj.label,
    },
    camera: {
      position: [cam.position.x, cam.position.y, cam.position.z],
      target:   [tgt.x, tgt.y, tgt.z],
      up:       [cam.up.x, cam.up.y, cam.up.z],
      fov:      cam.fov,
      aspect:   cam.aspect,
      near:     cam.near,
      far:      cam.far,
    },
    viewport: {
      width:  canvas.clientWidth,
      height: canvas.clientHeight,
    },
  };
  const json = JSON.stringify(bundle, null, 2);
  console.log('[james-marit-render] view JSON:\n' + json);

  let saved = false;
  try {
    const r = await fetch('/__save-view/james-marit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: json,
    });
    if (r.ok) {
      saved = true;
      exportStatus.flash(
        'saved to scripts/james-marit-view-preset.json',
        2500, '#9ec79e',
      );
    }
  } catch { /* fall through to clipboard */ }

  if (!saved) {
    try {
      await navigator.clipboard.writeText(json);
      exportStatus.flash('dev server unavailable — copied to clipboard instead', 2500, '#d9a55c');
    } catch {
      exportStatus.flash('clipboard blocked — see console for JSON', 2500, '#d9a55c');
    }
  }
}

// HUD is fully constructed now — sync the initial rep-mode slider state
// (selMode's onChange is only fired on user interaction, so we set the
// disabled flag explicitly here for the initial render).
slX.element.disabled = (repMode === 'modular-torus');
slY.element.disabled = (repMode === 'modular-torus');
rebuildFabiChart();
repipeline(true);

app.start();
