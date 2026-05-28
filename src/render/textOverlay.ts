/**
 * Anti-aliased text overlay for offline-rendered RGBA buffers.
 *
 * Pure-JS pipeline: opentype.js parses a bundled TTF (Inconsolata) and
 * returns glyph paths as `M`/`L`/`Q`/`C`/`Z` commands; we flatten Béziers
 * to line segments, then rasterize per-glyph by super-sampling pixel
 * centers (3×3 = 9 samples per pixel, alpha = covered/9) and alpha-blending
 * the result over the destination.
 *
 * No native deps, no Canvas2D, no headless browser. The bundled font is
 * Inconsolata Regular (~105 KB, SIL Open Font License — see
 * src/render/fonts/OFL.txt). Add other faces under src/render/fonts/ and
 * load them similarly if needed.
 *
 * Speed note. Per glyph we test (glyph_w × glyph_h × 9) sample points
 * against the glyph's flattened edges with a ray-cast (even-odd rule).
 * For Inconsolata at 14 px that's roughly 8×16×9 ≈ 1200 ray-casts per
 * glyph, each against ~30 edges — fast enough for the corner-annotation
 * use case (a few hundred glyphs per render).
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import opentype, { type Font, type Path, type PathCommand } from 'opentype.js';

// ─── Font loading (lazy) ───────────────────────────────────────────────────

const FONT_PATH = fileURLToPath(
  new URL('./fonts/Inconsolata-Regular.ttf', import.meta.url),
);
let cachedFont: Font | null = null;
function getFont(): Font {
  if (cachedFont !== null) return cachedFont;
  const buf = readFileSync(FONT_PATH);
  // opentype.parse needs an ArrayBuffer; node Buffer is a view on one.
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  cachedFont = opentype.parse(ab);
  return cachedFont;
}

// ─── Public types ──────────────────────────────────────────────────────────

export type RGB = readonly [number, number, number];

export interface TextStyle {
  /** Font size in destination pixels (cap height ≈ 0.7 × fontSize). */
  fontSize: number;
  /** Ink color, 0..255 per channel. */
  color: RGB;
  /** Line spacing as a multiple of fontSize; default 1.25. */
  lineHeight?: number;
}

// ─── Measurement ───────────────────────────────────────────────────────────

export function measureText(
  text: string, style: TextStyle,
): { w: number; h: number } {
  // Don't use font.getAdvanceWidth(line, ...) — that routes through
  // opentype.js's text-processing pipeline (Bidi + GSUB), which throws
  // on certain font features (e.g. Inconsolata's ccmp ligature lookup).
  // Sum per-glyph advance widths directly via charToGlyph instead.
  const font = getFont();
  const fontSize = style.fontSize;
  const unitsPerEm = font.unitsPerEm;
  const lineH = fontSize * (style.lineHeight ?? 1.25);
  const lines = text.split('\n');
  let maxW = 0;
  for (const line of lines) {
    let w = 0;
    for (const ch of line) {
      w += font.charToGlyph(ch).advanceWidth * fontSize / unitsPerEm;
    }
    if (w > maxW) maxW = w;
  }
  return { w: maxW, h: lines.length * lineH };
}

// ─── Drawing ───────────────────────────────────────────────────────────────

export function fillRect(
  rgba: Uint8Array, imgW: number, imgH: number,
  x: number, y: number, w: number, h: number,
  color: RGB,
): void {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(imgW, Math.ceil(x + w));
  const y1 = Math.min(imgH, Math.ceil(y + h));
  for (let py = y0; py < y1; py++) {
    for (let px = x0; px < x1; px++) {
      const idx = (py * imgW + px) * 4;
      rgba[idx]     = color[0];
      rgba[idx + 1] = color[1];
      rgba[idx + 2] = color[2];
      rgba[idx + 3] = 255;
    }
  }
}

/**
 * Draw `text` (with newlines) into `rgba` so that the top-left corner of
 * the first line's bounding box sits at (x, y).
 */
export function drawText(
  rgba: Uint8Array, imgW: number, imgH: number,
  text: string, x: number, y: number, style: TextStyle,
): void {
  const font = getFont();
  const fontSize = style.fontSize;
  const lineH = fontSize * (style.lineHeight ?? 1.25);
  // opentype.js positions text on its baseline; we want (x, y) to be the
  // top of the line's bounding box, so push the baseline down by ~ascender.
  const unitsPerEm = font.unitsPerEm;
  const ascender = font.ascender / unitsPerEm * fontSize;
  const lines = text.split('\n');

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    const baselineY = y + ascender + li * lineH;
    // For monospace, every advance is the same — but use font.getPath to
    // honour any internal hinting / kerning the font supplies.
    let cursorX = x;
    for (const ch of line) {
      const glyph = font.charToGlyph(ch);
      const advance = glyph.advanceWidth * fontSize / unitsPerEm;
      if (ch !== ' ') {
        const path = glyph.getPath(cursorX, baselineY, fontSize);
        rasterizePath(rgba, imgW, imgH, path, style.color);
      }
      cursorX += advance;
    }
  }
}

/**
 * Pick a font size that gives small-but-readable text relative to image
 * width. ~12 px at 1 K, ~24 px at 8 K. Caller can override by passing an
 * explicit `fontSize` in TextStyle.
 */
export function pickFontSize(imgW: number): number {
  return Math.max(10, Math.round(imgW / 350));
}

// ─── Rasterization internals ──────────────────────────────────────────────

interface Edge { x0: number; y0: number; x1: number; y1: number; }

const SS = 3;          // 3×3 super-samples per pixel
const SAMPLES = SS * SS;

function rasterizePath(
  rgba: Uint8Array, imgW: number, imgH: number,
  path: Path, color: RGB,
): void {
  const bbox = path.getBoundingBox();
  if (bbox.x1 >= imgW || bbox.x2 < 0 || bbox.y1 >= imgH || bbox.y2 < 0) return;

  const edges = flattenPath(path);
  if (edges.length === 0) return;

  const px0 = Math.max(0, Math.floor(bbox.x1));
  const py0 = Math.max(0, Math.floor(bbox.y1));
  const px1 = Math.min(imgW, Math.ceil(bbox.x2) + 1);
  const py1 = Math.min(imgH, Math.ceil(bbox.y2) + 1);

  // Precompute sample offsets for the 3×3 grid (centred in each pixel).
  const sampleOffs: number[] = [];
  for (let k = 0; k < SS; k++) sampleOffs.push((k + 0.5) / SS);

  for (let py = py0; py < py1; py++) {
    for (let px = px0; px < px1; px++) {
      let covered = 0;
      for (const oy of sampleOffs) {
        const sampleY = py + oy;
        for (const ox of sampleOffs) {
          const sampleX = px + ox;
          if (pointInsidePath(sampleX, sampleY, edges)) covered++;
        }
      }
      if (covered === 0) continue;
      const alpha = covered / SAMPLES;
      const idx = (py * imgW + px) * 4;
      const ir = rgba[idx];
      const ig = rgba[idx + 1];
      const ib = rgba[idx + 2];
      const oneMinus = 1 - alpha;
      rgba[idx]     = Math.round(color[0] * alpha + ir * oneMinus);
      rgba[idx + 1] = Math.round(color[1] * alpha + ig * oneMinus);
      rgba[idx + 2] = Math.round(color[2] * alpha + ib * oneMinus);
      rgba[idx + 3] = 255;
    }
  }
}

/** Even-odd point-in-polygon via horizontal ray casting. */
function pointInsidePath(x: number, y: number, edges: readonly Edge[]): boolean {
  let inside = false;
  for (const e of edges) {
    if ((e.y0 > y) !== (e.y1 > y)) {
      const xIntersect = e.x0 + (y - e.y0) * (e.x1 - e.x0) / (e.y1 - e.y0);
      if (x < xIntersect) inside = !inside;
    }
  }
  return inside;
}

/** Flatten opentype.js path commands to line segments. Béziers are
 *  subdivided into a small number of straight pieces (Inconsolata's
 *  small-radius curves at ~14 px don't need many). */
function flattenPath(path: Path): Edge[] {
  const edges: Edge[] = [];
  let cx = 0, cy = 0;
  let sx = 0, sy = 0;
  for (const cmd of path.commands as readonly PathCommand[]) {
    switch (cmd.type) {
      case 'M':
        cx = cmd.x; cy = cmd.y;
        sx = cx;    sy = cy;
        break;
      case 'L':
        edges.push({ x0: cx, y0: cy, x1: cmd.x, y1: cmd.y });
        cx = cmd.x; cy = cmd.y;
        break;
      case 'Q': {
        const N = 8;
        let pcx = cx, pcy = cy;
        for (let i = 1; i <= N; i++) {
          const t = i / N;
          const it = 1 - t;
          const px = it * it * cx + 2 * it * t * cmd.x1 + t * t * cmd.x;
          const py = it * it * cy + 2 * it * t * cmd.y1 + t * t * cmd.y;
          edges.push({ x0: pcx, y0: pcy, x1: px, y1: py });
          pcx = px; pcy = py;
        }
        cx = cmd.x; cy = cmd.y;
        break;
      }
      case 'C': {
        const N = 12;
        let pcx = cx, pcy = cy;
        for (let i = 1; i <= N; i++) {
          const t = i / N;
          const it = 1 - t;
          const it2 = it * it, it3 = it2 * it;
          const t2 = t * t,    t3 = t2 * t;
          const px = it3 * cx + 3 * it2 * t * cmd.x1 + 3 * it * t2 * cmd.x2 + t3 * cmd.x;
          const py = it3 * cy + 3 * it2 * t * cmd.y1 + 3 * it * t2 * cmd.y2 + t3 * cmd.y;
          edges.push({ x0: pcx, y0: pcy, x1: px, y1: py });
          pcx = px; pcy = py;
        }
        cx = cmd.x; cy = cmd.y;
        break;
      }
      case 'Z':
        if (cx !== sx || cy !== sy) {
          edges.push({ x0: cx, y0: cy, x1: sx, y1: sy });
          cx = sx; cy = sy;
        }
        break;
    }
  }
  return edges;
}
