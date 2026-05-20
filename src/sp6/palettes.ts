/**
 * sp6-specific color palettes.
 *
 * Each palette is an array of `[R, G, B]` triples (channels in [0, 1])
 * indexed by the category index that a color scheme assigns. Convention from
 * `@/render/colorScheme`:
 *   - cat 0 = basepoint / uncategorized
 *   - cats 1..4 = generators A, A⁻¹, B, B⁻¹ (last-gen / kth-last schemes)
 *
 * Palettes are chosen at render time, not bake time — accumulators store raw
 * category counts, so swapping palette is render-cheap.
 */

import type { Palette } from '../render/tone.ts';

/**
 * Default sp6 family palette: 4 generator colors (two warm shades for A/A⁻¹,
 * two cool shades for B/B⁻¹) plus a near-white basepoint at index 0.
 *
 * Suitable for the `last-gen` and `kth-last:k` schemes (categoryCount=5).
 */
export const sp6FamilyPalette: Palette = [
  [0.95, 0.95, 0.95], // 0: basepoint / uncategorized
  [0.65, 0.20, 0.15], // 1: A   — warm red
  [0.70, 0.40, 0.10], // 2: A⁻¹ — warm amber
  [0.10, 0.20, 0.55], // 3: B   — cool blue
  [0.10, 0.40, 0.55], // 4: B⁻¹ — cool teal
];

/**
 * Grayscale palette for the `grayscale` scheme (categoryCount=1). A single
 * mid-grey; the offline render's K=1 tone-map path doesn't actually consume
 * a palette, but the browser uses palette[0] for instance colors.
 */
export const sp6GrayscalePalette: Palette = [
  [0.35, 0.35, 0.35],
];

/** Pick the right sp6 palette for a given scheme name. */
export function paletteForScheme(schemeName: string): Palette {
  if (schemeName === 'grayscale') return sp6GrayscalePalette;
  if (schemeName === 'last-gen' || schemeName.startsWith('kth-last:')) {
    return sp6FamilyPalette;
  }
  return sp6GrayscalePalette;
}
