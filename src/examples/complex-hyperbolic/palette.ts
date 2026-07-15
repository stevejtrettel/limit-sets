/**
 * Palettes for SU(2,1) demos.
 *
 * Default 4-colour palette for the 3-involution ideal triangle alphabet:
 * basepoint + one colour per reflection ι₁, ι₂, ι₃ (also serves the
 * 2-free-generator rows, whose codes 0..3 land on the same slots plus the
 * warm/cool convention carrying over from sl2c).
 */

import { makePaletteSelector } from '../../render/paletteSelector.ts';
import type { Palette } from '../../render/tone.ts';

export const su21FamilyPalette: Palette = [
  [0.95, 0.95, 0.95],  // 0: basepoint / underflow
  [0.70, 0.20, 0.20],  // 1: ι₁ — warm red
  [0.15, 0.30, 0.65],  // 2: ι₂ — cool blue
  [0.20, 0.55, 0.25],  // 3: ι₃ — green
  [0.85, 0.45, 0.15],  // 4: (4th code in free alphabets) — warm orange
];

export const su21GrayscalePalette: Palette = [
  [0.35, 0.35, 0.35],
];

export const paletteForScheme = makePaletteSelector(su21FamilyPalette, su21GrayscalePalette);
