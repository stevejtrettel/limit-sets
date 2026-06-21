/**
 * o5-specific color palettes.
 *
 * The o5 action walks the free-product alphabet {T, B, B⁻¹} (3 generators), so
 * the last-letter category is lastGen + 1 ∈ {1, 2, 3} (0 = basepoint). We keep
 * a 5-entry palette so the categoryCount=5 last-gen / kth-last schemes never
 * index out of range; entry 4 is unused.
 */

import type { Palette } from '../render/tone.ts';

/** T = warm red, B = cool blue, B⁻¹ = cool teal; basepoint near-white. */
export const o5FamilyPalette: Palette = [
  [0.95, 0.95, 0.95], // 0: basepoint / uncategorized
  [0.65, 0.20, 0.15], // 1: T   — warm red (the reflection)
  [0.10, 0.20, 0.55], // 2: B   — cool blue
  [0.10, 0.40, 0.55], // 3: B⁻¹ — cool teal
  [0.35, 0.35, 0.35], // 4: unused (categoryCount padding)
];

export const o5GrayscalePalette: Palette = [
  [0.35, 0.35, 0.35],
];

export function paletteForScheme(schemeName: string): Palette {
  if (schemeName === 'grayscale') return o5GrayscalePalette;
  if (schemeName === 'last-gen' || schemeName.startsWith('kth-last:')) {
    return o5FamilyPalette;
  }
  return o5GrayscalePalette;
}
