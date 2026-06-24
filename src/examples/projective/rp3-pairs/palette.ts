/**
 * Palette for RP³ free-pair groups: basepoint + 4 generator colors
 * (A, A⁻¹, B, B⁻¹). categoryCount = 5 (`last-gen` / kth-last schemes).
 * (Migrated from src/sl4r/palettes.ts.)
 */

import { makePaletteSelector } from '../../../render/paletteSelector.ts';
import type { Palette } from '../../../render/tone.ts';

export const pairPalette: Palette = [
  [0.95, 0.95, 0.95], // 0: basepoint / uncategorized
  [0.65, 0.20, 0.15], // 1: A   — warm red
  [0.70, 0.40, 0.10], // 2: A⁻¹ — warm amber
  [0.10, 0.20, 0.55], // 3: B   — cool blue
  [0.10, 0.40, 0.55], // 4: B⁻¹ — cool teal
];

export const grayscalePalette: Palette = [
  [0.35, 0.35, 0.35],
];

export const paletteForScheme = makePaletteSelector(pairPalette, grayscalePalette);
