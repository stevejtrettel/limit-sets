/**
 * Marked-box subdivision viewer — Pappus modular-group representations.
 *
 * Draws the orbit of the initial marked box M_{c,d} under the nesting
 * operations t, b (and optionally — TBD — the involution i). Boxes
 * telescope into the limit set as depth increases. Each box is rendered
 * as a 4-edge quadrilateral outline color-graded by subdivision depth.
 *
 * Pipeline (all generic except the demo-specific chart + color LUT):
 *   1. subdivideTree from @/core/subdivision walks the binary subdivision
 *      tree of marked boxes via pappusChildren from @/schwartz-pappus/box.
 *   2. Project each box's 4 corners through the affine chart (x/(y+z),
 *      y/(y+z)) so M₀ is the unit rectangle [-1,1] × [0,1].
 *   3. Pack edges into Float32 position+color buffers with depth-graded HSL.
 *   4. makeColoredLineSegments from @/app/lineSegments wraps them as a
 *      Three.js LineSegments mesh.
 *   5. autofitCamera frames the scene straight-down (planar limit set).
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { ControlPanel } from '@/app/ControlPanel';
import { autofitCamera } from '@/app/autofit';
import {
  createLineSegmentsMaterial, makeColoredLineSegments,
} from '@/app/lineSegments';
import { subdivideTree, type DepthState } from '@/core/subdivision';
import {
  initialBox, pappusChildren,
  CORNER_IDX, TOP_MARK_IDX, BOTTOM_MARK_IDX,
  type MarkedBox, type Vec3,
} from '@/examples/projective/schwartz-pappus/box';
import { colorForDepth } from './colorLUT';
import type { MarkedBoxesViewPreset } from './viewPreset';

// ── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_C = 0.2;
const DEFAULT_D = 0.4;
const DEFAULT_DEPTH = 10;

const C_MIN = -0.95, C_MAX = 0.95, C_STEP = 0.001;
const D_MIN = -0.95, D_MAX = 0.95, D_STEP = 0.001;
const DEPTH_MIN = 0, DEPTH_MAX = 14;

// Affine-chart denominator threshold. Boxes with any corner at the chart's
// line at infinity (denom ≈ 0) are skipped — direct Pappus subdivision keeps
// all the descendants of M₀ on one side of the y+z=0 horizon for the
// default parameters, so this rarely triggers.
const EPS_DENOM = 1e-3;

// ── Scene ───────────────────────────────────────────────────────────────────

const app = new App({ antialias: true });
app.scene.background = new THREE.Color(0xffffff);

const lineMaterial  = createLineSegmentsMaterial();
const markMaterial  = new THREE.PointsMaterial({
  vertexColors: true, size: 0.02, sizeAttenuation: true,
});

let currentLines: THREE.LineSegments | null = null;
let currentMarks: THREE.Points       | null = null;

let c = DEFAULT_C;
let d = DEFAULT_D;
let depth = DEFAULT_DEPTH;
let showMarks = false;

// (Depth → RGB LUT lives in ./colorLUT.ts, shared with the offline render.)

// ── Affine-chart projection ─────────────────────────────────────────────────
// Chart: (x / (y+z), y / (y+z)). M₀'s four corners all satisfy y+z = 1, so
// it lands as the unit rectangle [-1, 1] × [0, 1] with marked points at
// (c, 1) and (d, 0). The standard (x/z, y/z) chart would put M₀'s two top
// corners at infinity, eating most of the orbit.

function denomOf(p: Vec3): number {
  return p[1] + p[2];
}

function projectAffine(p: Vec3): [number, number] | null {
  const denom = p[1] + p[2];
  if (Math.abs(denom) < EPS_DENOM) return null;
  return [p[0] / denom, p[1] / denom];
}

// ── Buffer building ─────────────────────────────────────────────────────────

interface BuiltBuffers {
  positions: Float32Array;
  colors:    Float32Array;
  count:     number; // active vertex count
}

/**
 * Each box contributes 4 edges → 8 vertices (LineSegments takes pairs).
 * CORNER_IDX is the static cyclic order (s, u, c, a) around the quad;
 * direct Pappus subdivision preserves this labelling at every depth, so
 * the static order traces a simple polygon — no need to sort by angle.
 */
function buildLineBuffers(
  boxes: readonly DepthState<MarkedBox>[],
  maxDepth: number,
): BuiltBuffers {
  const positions = new Float32Array(boxes.length * 8 * 3);
  const colors    = new Float32Array(boxes.length * 8 * 3);
  let v = 0;
  let skippedAtInfinity = 0;

  for (const { state: box, depth: d } of boxes) {
    const denoms = CORNER_IDX.map((i) => denomOf(box[i]));
    if (denoms.some((q) => Math.abs(q) < EPS_DENOM)) { skippedAtInfinity++; continue; }
    const cornersAffine: [number, number][] = CORNER_IDX.map(
      (i) => projectAffine(box[i])!,
    );
    const { r: cr, g: cg, b: cb } = colorForDepth(d, maxDepth);
    for (let e = 0; e < 4; e++) {
      const p0 = cornersAffine[e];
      const p1 = cornersAffine[(e + 1) % 4];
      positions[3 * v]     = p0[0]; positions[3 * v + 1] = p0[1]; positions[3 * v + 2] = 0;
      colors[3 * v]        = cr;    colors[3 * v + 1]    = cg;    colors[3 * v + 2]    = cb;
      v++;
      positions[3 * v]     = p1[0]; positions[3 * v + 1] = p1[1]; positions[3 * v + 2] = 0;
      colors[3 * v]        = cr;    colors[3 * v + 1]    = cg;    colors[3 * v + 2]    = cb;
      v++;
    }
  }
  if (boxes.length > 0 && skippedAtInfinity > 0) {
    console.log(
      `[marked-boxes] drew ${(v / 8).toLocaleString()}/${boxes.length.toLocaleString()} boxes; ` +
      `${skippedAtInfinity} skipped (at chart infinity)`,
    );
  }
  return { positions, colors, count: v };
}

function buildMarkBuffers(
  boxes: readonly DepthState<MarkedBox>[],
  maxDepth: number,
): BuiltBuffers {
  const positions = new Float32Array(boxes.length * 2 * 3);
  const colors    = new Float32Array(boxes.length * 2 * 3);
  let v = 0;
  for (const { state: box, depth: d } of boxes) {
    const { r: cr, g: cg, b: cb } = colorForDepth(d, maxDepth);
    for (const idx of [TOP_MARK_IDX, BOTTOM_MARK_IDX]) {
      const p = projectAffine(box[idx]);
      if (p === null) continue;
      positions[3 * v]     = p[0]; positions[3 * v + 1] = p[1]; positions[3 * v + 2] = 0;
      colors[3 * v]        = cr;   colors[3 * v + 1]    = cg;   colors[3 * v + 2]    = cb;
      v++;
    }
  }
  return { positions, colors, count: v };
}

function rebuildScene(autofit: boolean): void {
  let boxes: DepthState<MarkedBox>[];
  try {
    boxes = subdivideTree<MarkedBox>(
      initialBox(c, d),
      (M) => {
        const { t, b } = pappusChildren(M);
        return [t, b];
      },
      depth,
    );
  } catch (err) {
    panelMeta.html(
      `<span style="color:#d9a55c">error: ${err instanceof Error ? err.message : String(err)}</span>`,
    );
    return;
  }

  const lineBuf = buildLineBuffers(boxes, depth);
  const lines = makeColoredLineSegments(
    lineMaterial, lineBuf.positions, lineBuf.colors, lineBuf.count,
  );
  if (currentLines) {
    app.scene.remove(currentLines);
    currentLines.geometry.dispose();
  }
  app.scene.add(lines);
  currentLines = lines;

  if (currentMarks) {
    app.scene.remove(currentMarks);
    currentMarks.geometry.dispose();
  }
  if (showMarks) {
    const markBuf = buildMarkBuffers(boxes, depth);
    const markGeom = new THREE.BufferGeometry();
    markGeom.setAttribute('position', new THREE.BufferAttribute(
      markBuf.positions.subarray(0, markBuf.count * 3), 3,
    ));
    markGeom.setAttribute('color', new THREE.BufferAttribute(
      markBuf.colors.subarray(0, markBuf.count * 3), 3,
    ));
    const marks = new THREE.Points(markGeom, markMaterial);
    app.scene.add(marks);
    currentMarks = marks;
  } else {
    currentMarks = null;
  }

  if (autofit) {
    autofitCamera(app, lineBuf.positions, lineBuf.count, { dir: [0, 0, 1] });
  }

  statsEl.text(
    `${boxes.length.toLocaleString()} boxes, ` +
    `${lineBuf.count.toLocaleString()} vertices`,
  );
  panelMeta.html(
    `(c, d) = (${c.toFixed(3)}, ${d.toFixed(3)}), depth N = ${depth} → 2^${depth} = ${(1 << depth).toLocaleString()} leaf boxes`,
  );
}

// ── HUD ─────────────────────────────────────────────────────────────────────

const panel = new ControlPanel({ title: 'Marked boxes — Pappus subdivision' });
const statsEl   = panel.text({ variant: 'stats' });
const panelMeta = panel.text({ variant: 'meta' });

const pappusFolder = panel.folder('Pappus parameters (c, d)', { open: true });
const slC = pappusFolder.slider({
  label: 'c',
  min: C_MIN, max: C_MAX, step: C_STEP, value: c,
  format: (v) => v.toFixed(3),
  event: 'input',
  onChange: (v) => { c = v; rebuildScene(false); },
});
const slD = pappusFolder.slider({
  label: 'd',
  min: D_MIN, max: D_MAX, step: D_STEP, value: d,
  format: (v) => v.toFixed(3),
  event: 'input',
  onChange: (v) => { d = v; rebuildScene(false); },
});

const viewFolder = panel.folder('View', { open: true });
const slDepth = viewFolder.slider({
  label: 'depth N',
  min: DEPTH_MIN, max: DEPTH_MAX, step: 1, value: depth,
  onChange: (v) => { depth = v; rebuildScene(false); },
});
viewFolder.select({
  label: 'marked points',
  options: [
    { value: 'off', label: 'off' },
    { value: 'on',  label: 'on (slow at high depth)' },
  ],
  value: 'off',
  onChange: (v) => { showMarks = v === 'on'; rebuildScene(false); },
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

const actionsFolder = panel.folder('Actions');
actionsFolder.button({
  label: 'reset',
  onClick: () => {
    c = DEFAULT_C; d = DEFAULT_D; depth = DEFAULT_DEPTH; showMarks = false;
    slC.set(c); slD.set(d); slDepth.set(depth);
    slFov.set(DEFAULT_FOV);
    app.camera.fov = DEFAULT_FOV;
    app.camera.updateProjectionMatrix();
    rebuildScene(true);
  },
});
actionsFolder.button({
  label: 'screenshot',
  onClick: () => {
    app.screenshot(
      `marked-boxes_c${c.toFixed(3)}_d${d.toFixed(3)}_depth${depth}_${shotTimestamp()}.png`,
    );
  },
});
actionsFolder.button({
  label: 'copy view JSON for offline render',
  onClick: exportView,
});
const exportStatus = actionsFolder.text({ variant: 'meta' });

function shotTimestamp(): string {
  return new Date().toISOString().replace(/[-:]|\..*/g, '').replace('T', '-');
}

// ─── Export view for offline render ────────────────────────────────────────
//
// Compute the visible chart-coords bbox from the current orbit camera
// (assumes the user is looking straight down, which is the demo's default
// for this 2D scene — autofitCamera uses dir = (0, 0, 1) and OrbitControls
// only rotates if the user explicitly drags). For a perspective camera at
// distance d above the z=0 plane: visible half-height = d · tan(fov/2),
// half-width = half-height · aspect.

async function exportView(): Promise<void> {
  const cam = app.camera as THREE.PerspectiveCamera;
  const tgt = app.controls.target;
  const distance = cam.position.distanceTo(tgt);
  const halfH = distance * Math.tan((cam.fov * Math.PI / 180) * 0.5);
  const halfW = halfH * cam.aspect;
  const canvas = app.renderManager.renderer.domElement;
  const bundle: MarkedBoxesViewPreset = {
    exampleId: 'marked-boxes',
    c, d, depth,
    bbox: {
      xMin: tgt.x - halfW, xMax: tgt.x + halfW,
      yMin: tgt.y - halfH, yMax: tgt.y + halfH,
    },
    viewport: {
      width:  canvas.clientWidth,
      height: canvas.clientHeight,
    },
    showMarks,
    background: 'white',
  };
  const json = JSON.stringify(bundle, null, 2);
  console.log('[marked-boxes-render] view JSON:\n' + json);

  let saved = false;
  try {
    const r = await fetch('/__save-view/marked-boxes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: json,
    });
    if (r.ok) {
      saved = true;
      exportStatus.flash(
        'saved to scripts/marked-boxes-view-preset.json — run ' +
        '`node scripts/marked-boxes-render-limit-set.ts`',
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

rebuildScene(true);
app.start();
