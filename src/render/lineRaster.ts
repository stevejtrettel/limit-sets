/**
 * Anti-aliased 1-pixel line rasterization into an RGBA buffer
 * (Xiaolin Wu's algorithm).
 *
 * Used by the offline render scripts that draw line-based limit sets
 * (e.g. marked-boxes subdivision quads). For the point-cloud limit sets,
 * the accumulator / tone-map pipeline in render/accumulator.ts is the
 * right tool; this one is for crisp single-pixel-thick AA lines.
 *
 * The line is "drawn ON TOP" of whatever is already in `rgba`: each
 * touched pixel is alpha-blended (premultiplied src-over) with the line
 * color weighted by Wu coverage. Clipping is handled per pixel — fully
 * off-image pixels just no-op.
 */

export type RGB = readonly [number, number, number];

/**
 * Plot one pixel of the line with `coverage` (0..1) of the line color
 * blended over the existing pixel. Off-image pixels are skipped silently.
 */
function plot(
  rgba: Uint8Array, w: number, h: number,
  x: number, y: number, coverage: number, color: RGB,
): void {
  if (x < 0 || x >= w || y < 0 || y >= h || coverage <= 0) return;
  const idx = (y * w + x) * 4;
  const oneMinus = 1 - coverage;
  rgba[idx]     = Math.round(color[0] * coverage + rgba[idx]     * oneMinus);
  rgba[idx + 1] = Math.round(color[1] * coverage + rgba[idx + 1] * oneMinus);
  rgba[idx + 2] = Math.round(color[2] * coverage + rgba[idx + 2] * oneMinus);
  rgba[idx + 3] = 255;
}

const ipart  = (x: number): number => Math.floor(x);
const fpart  = (x: number): number => x - Math.floor(x);
const rfpart = (x: number): number => 1 - fpart(x);

/**
 * Draw an anti-aliased line from (x0, y0) to (x1, y1) into `rgba` using
 * Xiaolin Wu's algorithm. Coordinates are in destination pixel space
 * (floats allowed; sub-pixel positioning gives the AA).
 *
 * `opacity` (0..1, default 1) scales every pixel's coverage, for faint /
 * translucent strokes (e.g. a light hull wireframe). It composites over
 * whatever is already there, so the stroke reads lighter without changing
 * its 1-pixel thickness.
 */
export function drawLineAA(
  rgba: Uint8Array, w: number, h: number,
  x0: number, y0: number, x1: number, y1: number,
  color: RGB, opacity = 1,
): void {
  const P = (x: number, y: number, cov: number): void =>
    plot(rgba, w, h, x, y, cov * opacity, color);

  const steep = Math.abs(y1 - y0) > Math.abs(x1 - x0);
  if (steep) {
    [x0, y0] = [y0, x0];
    [x1, y1] = [y1, x1];
  }
  if (x0 > x1) {
    [x0, x1] = [x1, x0];
    [y0, y1] = [y1, y0];
  }
  const dx = x1 - x0;
  const dy = y1 - y0;
  const gradient = dx === 0 ? 1 : dy / dx;

  // first endpoint
  let xend  = Math.round(x0);
  let yend  = y0 + gradient * (xend - x0);
  let xgap  = rfpart(x0 + 0.5);
  const xpxl1 = xend;
  const ypxl1 = ipart(yend);
  if (steep) {
    P(ypxl1,     xpxl1, rfpart(yend) * xgap);
    P(ypxl1 + 1, xpxl1, fpart(yend)  * xgap);
  } else {
    P(xpxl1, ypxl1,     rfpart(yend) * xgap);
    P(xpxl1, ypxl1 + 1, fpart(yend)  * xgap);
  }
  let intery = yend + gradient;

  // second endpoint
  xend = Math.round(x1);
  yend = y1 + gradient * (xend - x1);
  xgap = fpart(x1 + 0.5);
  const xpxl2 = xend;
  const ypxl2 = ipart(yend);
  if (steep) {
    P(ypxl2,     xpxl2, rfpart(yend) * xgap);
    P(ypxl2 + 1, xpxl2, fpart(yend)  * xgap);
  } else {
    P(xpxl2, ypxl2,     rfpart(yend) * xgap);
    P(xpxl2, ypxl2 + 1, fpart(yend)  * xgap);
  }

  // main loop
  if (steep) {
    for (let x = xpxl1 + 1; x < xpxl2; x++) {
      P(ipart(intery),     x, rfpart(intery));
      P(ipart(intery) + 1, x, fpart(intery));
      intery += gradient;
    }
  } else {
    for (let x = xpxl1 + 1; x < xpxl2; x++) {
      P(x, ipart(intery),     rfpart(intery));
      P(x, ipart(intery) + 1, fpart(intery));
      intery += gradient;
    }
  }
}

/**
 * Anti-aliased round-capped stroke of arbitrary `width` (in pixels), for
 * figure-quality linework where Wu's 1-pixel line is too thin to read — hull
 * edges and silhouettes on a 6000-pixel-wide render.
 *
 * Coverage is the analytic distance-to-segment falloff: a pixel is fully inked
 * within (width/2 − ½) of the segment and fades to nothing at (width/2 + ½), so
 * the stroke keeps a constant apparent weight at any width, including sub-pixel.
 * `opacity` (0..1) scales the whole stroke, for depth-faded / occluded edges.
 */
export function drawThickLineAA(
  rgba: Uint8Array, w: number, h: number,
  x0: number, y0: number, x1: number, y1: number,
  color: RGB, width: number, opacity = 1,
): void {
  if (opacity <= 0 || width <= 0) return;
  const half = width / 2;
  const pad = half + 1;
  const minX = Math.max(0, Math.floor(Math.min(x0, x1) - pad));
  const maxX = Math.min(w - 1, Math.ceil(Math.max(x0, x1) + pad));
  const minY = Math.max(0, Math.floor(Math.min(y0, y1) - pad));
  const maxY = Math.min(h - 1, Math.ceil(Math.max(y0, y1) + pad));
  if (minX > maxX || minY > maxY) return;

  const dx = x1 - x0, dy = y1 - y0;
  const len2 = dx * dx + dy * dy;
  for (let y = minY; y <= maxY; y++) {
    const py = y + 0.5;
    for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5;
      let t = len2 > 0 ? ((px - x0) * dx + (py - y0) * dy) / len2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const dist = Math.hypot(px - (x0 + t * dx), py - (y0 + t * dy));
      const cov = half + 0.5 - dist;
      if (cov <= 0) continue;
      plot(rgba, w, h, x, y, (cov < 1 ? cov : 1) * opacity, color);
    }
  }
}

/**
 * Anti-aliased filled disc — the dot at a projected vertex. Same coverage model
 * as {@link drawThickLineAA}, so dots and strokes carry matching weight.
 */
export function drawDiscAA(
  rgba: Uint8Array, w: number, h: number,
  cx: number, cy: number, radius: number, color: RGB, opacity = 1,
): void {
  if (opacity <= 0 || radius <= 0) return;
  const minX = Math.max(0, Math.floor(cx - radius - 1));
  const maxX = Math.min(w - 1, Math.ceil(cx + radius + 1));
  const minY = Math.max(0, Math.floor(cy - radius - 1));
  const maxY = Math.min(h - 1, Math.ceil(cy + radius + 1));
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const cov = radius + 0.5 - Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (cov <= 0) continue;
      plot(rgba, w, h, x, y, (cov < 1 ? cov : 1) * opacity, color);
    }
  }
}

/**
 * Convenience: fill the entire `rgba` buffer with a single solid color.
 * (Background paint for line-based renders.)
 */
export function fillBackground(
  rgba: Uint8Array, w: number, h: number, color: RGB,
): void {
  for (let i = 0; i < w * h; i++) {
    rgba[4 * i]     = color[0];
    rgba[4 * i + 1] = color[1];
    rgba[4 * i + 2] = color[2];
    rgba[4 * i + 3] = 255;
  }
}
