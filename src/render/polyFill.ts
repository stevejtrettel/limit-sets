/**
 * Translucent filled-polygon rasterization into an RGBA buffer — the area
 * companion to lineRaster.ts's anti-aliased lines.
 *
 *   fillTriangleAlpha — scanline-fill a triangle, src-over alpha-blending a
 *                       single color into each covered pixel.
 *
 * Used to paint convex-hull faces as "glass" over a density image: draw all
 * faces at low alpha (front and back accumulate, reading as translucent
 * volume), then stroke the polytope edges with drawLineAA on top.
 *
 * Coverage is hard per pixel (no edge AA); rely on the edge lines for crisp
 * boundaries. Pixels outside [0,w)×[0,h) are skipped.
 */

export type RGB = readonly [number, number, number];

function blend(rgba: Uint8Array, idx: number, color: RGB, a: number): void {
  const ia = 1 - a;
  rgba[idx]     = Math.round(color[0] * a + rgba[idx]     * ia);
  rgba[idx + 1] = Math.round(color[1] * a + rgba[idx + 1] * ia);
  rgba[idx + 2] = Math.round(color[2] * a + rgba[idx + 2] * ia);
  rgba[idx + 3] = 255;
}

/**
 * Fill the triangle (ax,ay),(bx,by),(cx,cy) in pixel space, blending `color`
 * at opacity `alpha` over the existing buffer. Vertices may lie off-image
 * (only covered in-image pixels are touched).
 */
export function fillTriangleAlpha(
  rgba: Uint8Array, w: number, h: number,
  ax: number, ay: number, bx: number, by: number, cx: number, cy: number,
  color: RGB, alpha: number,
): void {
  if (alpha <= 0) return;
  const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx)));
  const maxX = Math.min(w - 1, Math.ceil(Math.max(ax, bx, cx)));
  const minY = Math.max(0, Math.floor(Math.min(ay, by, cy)));
  const maxY = Math.min(h - 1, Math.ceil(Math.max(ay, by, cy)));
  if (minX > maxX || minY > maxY) return;

  const area = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);
  if (Math.abs(area) < 1e-9) return;
  const inv = 1 / area;

  for (let y = minY; y <= maxY; y++) {
    const py = y + 0.5;
    for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5;
      // Barycentric coordinates of the pixel center.
      const w0 = ((bx - px) * (cy - py) - (cx - px) * (by - py)) * inv;
      const w1 = ((cx - px) * (ay - py) - (ax - px) * (cy - py)) * inv;
      const w2 = 1 - w0 - w1;
      if (w0 < -1e-7 || w1 < -1e-7 || w2 < -1e-7) continue;
      blend(rgba, (y * w + x) * 4, color, alpha);
    }
  }
}
