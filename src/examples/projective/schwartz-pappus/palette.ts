/**
 * Palette for the Schwartz–Pappus Anosov rep: basepoint + the free pair
 * (r₁, r₁⁻¹, r₂, r₂⁻¹). categoryCount = 5 for the last-gen / kth-last schemes.
 */

import { makePaletteSelector } from '../../../render/paletteSelector.ts';
import type { Palette } from '../../../render/tone.ts';

export const pappusPalette: Palette = [
  [0.95, 0.95, 0.95], // 0: basepoint / uncategorized
  [0.65, 0.20, 0.15], // 1: r₁   — warm red
  [0.70, 0.40, 0.10], // 2: r₁⁻¹ — warm amber
  [0.10, 0.20, 0.55], // 3: r₂   — cool blue
  [0.10, 0.40, 0.55], // 4: r₂⁻¹ — cool teal
];

export const grayscalePalette: Palette = [
  [0.35, 0.35, 0.35],
];

export const paletteForScheme = makePaletteSelector(pappusPalette, grayscalePalette);
