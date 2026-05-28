/**
 * Depth-graded color LUT for marked-box subdivision visualisations.
 *
 * Hue from 200° (blue) at depth 0 → 280° (purple) at maxDepth, lightness
 * sliding from 0.75 (light) at the root → 0.25 (dark) at the leaves.
 * Narrow hue range so the gradient reads as "shrinking through the
 * fractal" rather than rainbow noise.
 *
 * Shared between demos/marked-boxes/main.ts (live preview) and
 * scripts/marked-boxes-render-limit-set.ts (offline PNG) so the two
 * always agree. HSL math is inlined here so the offline-render path
 * doesn't pull in Three.js.
 */

export interface RGB01 {
  r: number;
  g: number;
  b: number;
}

/** Depth → RGB in 0..1 (matches Three.js setHSL convention). */
export function colorForDepth(depth: number, maxDepth: number): RGB01 {
  const t = maxDepth === 0 ? 0 : depth / maxDepth;
  const hue   = (200 + 80 * t) / 360;
  const sat   = 0.45 + 0.35 * t;
  const light = 0.75 - 0.50 * t;
  return hslToRgb(hue, sat, light);
}

/** Convenience for the offline renderer: depth → 0..255 RGB tuple. */
export function colorForDepth255(
  depth: number, maxDepth: number,
): readonly [number, number, number] {
  const c = colorForDepth(depth, maxDepth);
  return [Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255)];
}

// ─── HSL → RGB (h, s, l ∈ [0, 1]; matches Three.js setHSL) ────────────────

function hslToRgb(h: number, s: number, l: number): RGB01 {
  if (s === 0) return { r: l, g: l, b: l };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: hueToChannel(p, q, h + 1 / 3),
    g: hueToChannel(p, q, h),
    b: hueToChannel(p, q, h - 1 / 3),
  };
}

function hueToChannel(p: number, q: number, t: number): number {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}
