/**
 * Palette for the James–Marit SL(4,ℝ) rep: basepoint + the free pair
 * (A, A⁻¹, B, B⁻¹). categoryCount = 5 for the last-gen / kth-last schemes.
 */

import { makePaletteSelector } from '../../render/paletteSelector.ts';
import type { Palette } from '../../render/tone.ts';

export const jamesMaritPalette: Palette = [
  [0.95, 0.95, 0.95], // 0: basepoint / uncategorized
  [0.65, 0.20, 0.15], // 1: A   — warm red
  [0.70, 0.40, 0.10], // 2: A⁻¹ — warm amber
  [0.10, 0.20, 0.55], // 3: B   — cool blue
  [0.10, 0.40, 0.55], // 4: B⁻¹ — cool teal
];

export const grayscalePalette: Palette = [
  [0.35, 0.35, 0.35],
];

export const paletteForScheme = makePaletteSelector(jamesMaritPalette, grayscalePalette);
