/**
 * sl4r palettes for free-pair groups: basepoint + 4 generator colors
 * (A, A⁻¹, B, B⁻¹), matching the sp6 color convention. Slot 4 is the
 * fifth padding slot used by the categoryCount=5 `last-gen` scheme.
 */

import { makePaletteSelector } from '../render/paletteSelector.ts';
import type { Palette } from '../render/tone.ts';

export const sl4rFamilyPalette: Palette = [
  [0.95, 0.95, 0.95], // 0: basepoint / uncategorized
  [0.65, 0.20, 0.15], // 1: A   — warm red
  [0.70, 0.40, 0.10], // 2: A⁻¹ — warm amber
  [0.10, 0.20, 0.55], // 3: B   — cool blue
  [0.10, 0.40, 0.55], // 4: B⁻¹ — cool teal
];

export const sl4rGrayscalePalette: Palette = [
  [0.35, 0.35, 0.35],
];

export const paletteForScheme = makePaletteSelector(sl4rFamilyPalette, sl4rGrayscalePalette);
