/**
 * Palette for RP⁶ three-involution groups: basepoint + 3 generator colors
 * (g₁, g₂, g₃). categoryCount = 4 (`last-gen` / kth-last schemes).
 */

import { makePaletteSelector } from '../../../render/paletteSelector.ts';
import type { Palette } from '../../../render/tone.ts';

export const triplePalette: Palette = [
  [0.95, 0.95, 0.95], // 0: basepoint / uncategorized
  [0.65, 0.20, 0.15], // 1: g₁ — warm red
  [0.15, 0.45, 0.30], // 2: g₂ — green
  [0.10, 0.25, 0.60], // 3: g₃ — blue
];

export const grayscalePalette: Palette = [
  [0.35, 0.35, 0.35],
];

export const paletteForScheme = makePaletteSelector(triplePalette, grayscalePalette);
