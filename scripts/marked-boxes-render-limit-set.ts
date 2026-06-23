/**
 * marked-boxes-render-limit-set.ts
 *
 * Offline PNG render of the Schwartz–Pappus marked-box subdivision.
 * Reads `scripts/marked-boxes-view-preset.json` (written by the demo's
 * "copy view JSON for offline render" button) for parameters + visible
 * bbox + viewport aspect, walks the subdivision tree, rasterizes each
 * box's 4 edges into an RGBA buffer using Xiaolin Wu's AA algorithm,
 * and writes a PNG.
 *
 *   node scripts/marked-boxes-render-limit-set.ts [depth] [flags...]
 *
 *   --max-dim N        long-side image dim (default 8192)
 *   --bg white|black   background paint (default from preset / white)
 *   --no-marks         force marked points off
 *   --marks            force marked points on
 *   --refresh          (no-op; kept for parity — this pipeline has no
 *                       accumulator cache because the math is fast)
 *
 * Workflow: in the browser, tune (c, d, depth) and frame the view, then
 * press "copy view JSON for offline render", then run this script.
 */

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { writePng } from '../src/render/png.ts';
import { outputPath } from '../src/render/outputPath.ts';
import { drawLineAA, fillBackground, type RGB } from '../src/render/lineRaster.ts';
import {
  subdivideTree, type DepthState,
} from '../src/core/subdivision.ts';
import {
  initialBox, pappusChildren,
  CORNER_IDX, TOP_MARK_IDX, BOTTOM_MARK_IDX,
  type MarkedBox, type Vec3,
} from '../src/schwartz-pappus/box.ts';
import { colorForDepth255 } from '../demos/marked-boxes/colorLUT.ts';
import type { MarkedBoxesViewPreset } from '../demos/marked-boxes/viewPreset.ts';

// ─── Defaults ──────────────────────────────────────────────────────────────

const DEFAULT_DEPTH = 10;
let MAX_DIM = 8192;
const MIN_DIM = 128;
const DIM_ROUND = 16;

let BG: 'white' | 'black' = 'white';
let DEPTH: number = DEFAULT_DEPTH;
let SHOW_MARKS: boolean | undefined = undefined; // undefined = use preset's

const EPS_DENOM = 1e-3;
const log = (m: string): void => { process.stderr.write(m + '\n'); };

// ─── Load preset ───────────────────────────────────────────────────────────

const VIEW_PRESET_PATH = fileURLToPath(
  new URL('./marked-boxes-view-preset.json', import.meta.url),
);
if (!existsSync(VIEW_PRESET_PATH)) {
  log(`[marked-boxes-render] missing ${VIEW_PRESET_PATH}`);
  log(`    Open the marked-boxes demo in the browser, frame the view,`);
  log(`    then press "copy view JSON for offline render" — that writes this file.`);
  process.exit(1);
}

let VIEW_PRESET: MarkedBoxesViewPreset;
try {
  VIEW_PRESET = JSON.parse(readFileSync(VIEW_PRESET_PATH, 'utf8')) as MarkedBoxesViewPreset;
} catch (e) {
  log(`[marked-boxes-render] failed to parse view preset: ${(e as Error).message}`);
  process.exit(1);
}

DEPTH = VIEW_PRESET.depth ?? DEFAULT_DEPTH;
if (VIEW_PRESET.background === 'white' || VIEW_PRESET.background === 'black') {
  BG = VIEW_PRESET.background;
}

log(`[marked-boxes-render] loaded marked-boxes-view-preset.json` +
    ` (c=${VIEW_PRESET.c.toFixed(3)}, d=${VIEW_PRESET.d.toFixed(3)},` +
    ` depth=${VIEW_PRESET.depth}, bbox=[${VIEW_PRESET.bbox.xMin.toFixed(3)},` +
    `${VIEW_PRESET.bbox.xMax.toFixed(3)}] × [${VIEW_PRESET.bbox.yMin.toFixed(3)},` +
    `${VIEW_PRESET.bbox.yMax.toFixed(3)}])`);

// ─── argv parsing ──────────────────────────────────────────────────────────

const ARGS = process.argv.slice(2);

function flagValue(name: string): string | null {
  const i = ARGS.indexOf(name);
  return i >= 0 && i + 1 < ARGS.length ? ARGS[i + 1] : null;
}

function applyInt(
  name: string,
  set: (n: number) => void,
  predicate: (n: number) => boolean = (n) => Number.isFinite(n) && n > 0,
): void {
  const v = flagValue(name); if (v === null) return;
  const n = parseInt(v, 10);
  if (predicate(n)) set(n); else log(`[marked-boxes-render] ignoring ${name}=${v} (invalid)`);
}

applyInt('--max-dim', (n) => { MAX_DIM = n; }, (n) => Number.isFinite(n) && n >= 256);
{
  const v = flagValue('--bg');
  if (v === 'white' || v === 'black') BG = v;
  else if (v !== null) log(`[marked-boxes-render] ignoring --bg=${v} (expected "white" or "black")`);
}
if (ARGS.includes('--no-marks')) SHOW_MARKS = false;
if (ARGS.includes('--marks'))    SHOW_MARKS = true;

const VALUE_FLAGS = new Set(['--max-dim', '--bg']);
const skipIdx = new Set<number>();
for (let i = 0; i < ARGS.length; i++) if (VALUE_FLAGS.has(ARGS[i])) skipIdx.add(i + 1);
const depthArg = ARGS.find((a, i) =>
  !a.startsWith('--') && !skipIdx.has(i),
);
if (depthArg !== undefined) {
  const n = parseInt(depthArg, 10);
  if (Number.isFinite(n) && n >= 0) {
    DEPTH = n;
    log(`[marked-boxes-render] depth=${DEPTH} (from command line)`);
  } else {
    log(`[marked-boxes-render] ignoring non-integer depth arg "${depthArg}"`);
  }
}
if (DEPTH === VIEW_PRESET.depth && depthArg === undefined && process.stdin.isTTY) {
  const { createInterface } = await import('node:readline/promises');
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question(`BFS depth [default ${DEPTH}]: `)).trim();
  rl.close();
  if (answer !== '') {
    const n = parseInt(answer, 10);
    if (Number.isFinite(n) && n >= 0) DEPTH = n;
    else log(`[marked-boxes-render] invalid depth "${answer}", using default ${DEPTH}`);
  }
}

const showMarks = SHOW_MARKS ?? VIEW_PRESET.showMarks ?? false;

// ─── Image dimensions (preserve aspect, round to DIM_ROUND) ───────────────

const aspect = VIEW_PRESET.viewport.width / VIEW_PRESET.viewport.height;
let imgW: number, imgH: number;
if (aspect >= 1) {
  imgW = Math.max(MIN_DIM, Math.round(MAX_DIM / DIM_ROUND) * DIM_ROUND);
  imgH = Math.max(MIN_DIM, Math.round(imgW / aspect / DIM_ROUND) * DIM_ROUND);
} else {
  imgH = Math.max(MIN_DIM, Math.round(MAX_DIM / DIM_ROUND) * DIM_ROUND);
  imgW = Math.max(MIN_DIM, Math.round(imgH * aspect / DIM_ROUND) * DIM_ROUND);
}

log(`[marked-boxes-render] depth=${DEPTH}, image=${imgW}×${imgH}, bg=${BG}, marks=${showMarks ? 'on' : 'off'}`);

const tStart = Date.now();

// ─── Build orbit ───────────────────────────────────────────────────────────

log(`Subdividing to depth ${DEPTH}...`);
const tSub = Date.now();
const c = VIEW_PRESET.c;
const d = VIEW_PRESET.d;
const boxes: DepthState<MarkedBox>[] = subdivideTree<MarkedBox>(
  initialBox(c, d),
  (M) => {
    const { t, b } = pappusChildren(M);
    return [t, b];
  },
  DEPTH,
);
log(`  ${boxes.length.toLocaleString()} boxes in ${Date.now() - tSub} ms`);

// ─── Project + rasterize ──────────────────────────────────────────────────

const { xMin, xMax, yMin, yMax } = VIEW_PRESET.bbox;
const xSpan = xMax - xMin;
const ySpan = yMax - yMin;

function denomOf(p: Vec3): number { return p[1] + p[2]; }

/** Map an affine chart point (x, y) to pixel coords. y flipped (chart y
 *  increases up; pixel y increases down). */
function projectToPixel(p: Vec3): [number, number] | null {
  const denom = p[1] + p[2];
  if (Math.abs(denom) < EPS_DENOM) return null;
  const cx = p[0] / denom;
  const cy = p[1] / denom;
  const px = (cx - xMin) / xSpan * imgW;
  const py = (1 - (cy - yMin) / ySpan) * imgH;
  return [px, py];
}

const rgba = new Uint8Array(imgW * imgH * 4);
fillBackground(rgba, imgW, imgH, BG === 'white' ? [255, 255, 255] : [0, 0, 0]);

log(`Rasterizing ${boxes.length.toLocaleString()} boxes (4 edges each)...`);
const tRast = Date.now();

let drawnBoxes = 0;
let skippedAtInfinity = 0;
let markCount = 0;

for (const { state: box, depth: depthOf } of boxes) {
  // Skip if any corner is at the chart's line at infinity (denom ≈ 0).
  const denoms = CORNER_IDX.map((i) => denomOf(box[i]));
  if (denoms.some((q) => Math.abs(q) < EPS_DENOM)) { skippedAtInfinity++; continue; }
  const cornersAffine: [number, number][] = CORNER_IDX.map(
    (i) => projectToPixel(box[i])!,
  );
  const color: RGB = colorForDepth255(depthOf, DEPTH);
  for (let e = 0; e < 4; e++) {
    const p0 = cornersAffine[e];
    const p1 = cornersAffine[(e + 1) % 4];
    drawLineAA(rgba, imgW, imgH, p0[0], p0[1], p1[0], p1[1], color);
  }
  drawnBoxes++;

  if (showMarks) {
    for (const idx of [TOP_MARK_IDX, BOTTOM_MARK_IDX]) {
      const p = projectToPixel(box[idx]);
      if (p === null) continue;
      // Draw a small 2x2 dot at the marked point.
      const mx = Math.round(p[0]);
      const my = Math.round(p[1]);
      for (let dy = -1; dy <= 0; dy++) for (let dx = -1; dx <= 0; dx++) {
        const px = mx + dx, py = my + dy;
        if (px < 0 || px >= imgW || py < 0 || py >= imgH) continue;
        const j = (py * imgW + px) * 4;
        rgba[j]     = color[0];
        rgba[j + 1] = color[1];
        rgba[j + 2] = color[2];
        rgba[j + 3] = 255;
      }
      markCount++;
    }
  }
}
log(`  drew ${drawnBoxes.toLocaleString()} boxes, skipped ${skippedAtInfinity} at-infinity` +
    (showMarks ? `, ${markCount.toLocaleString()} marked points` : '') +
    ` in ${Date.now() - tRast} ms`);

// ─── Write PNG ─────────────────────────────────────────────────────────────

const cTag = `c${c.toFixed(3)}`;
const dTag = `d${d.toFixed(3)}`;
const outputFile = outputPath('marked-boxes', `marked-boxes-${cTag}-${dTag}-depth${DEPTH}-${imgW}x${imgH}${BG === 'black' ? '-black' : ''}.png`);
log(`Writing ${outputFile}...`);
const tWrite = Date.now();
await writePng(outputFile, imgW, imgH, rgba);
log(`  wrote PNG in ${Date.now() - tWrite} ms`);

log(`Done — total ${((Date.now() - tStart) / 1000).toFixed(1)}s`);
