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

/**
 * Tetrahedron palette: basepoint + the 6 edge reflections in TETRA_EDGES
 * order, with OPPOSITE-EDGE PAIRS in related hues — (ι₁₂, ι₃₄) reds,
 * (ι₁₃, ι₂₄) blues, (ι₁₄, ι₂₃) greens — so the pairing that governs the
 * dynamics (opposite-edge products are the loxodromic/elliptic gatekeepers)
 * is readable directly in the limit set.
 */
export const su21TetraPalette: Palette = [
  [0.95, 0.95, 0.95],  // 0: basepoint / underflow
  [0.70, 0.15, 0.15],  // 1: ι₁₂ — deep red
  [0.15, 0.25, 0.65],  // 2: ι₁₃ — deep blue
  [0.10, 0.48, 0.22],  // 3: ι₁₄ — deep green
  [0.45, 0.70, 0.35],  // 4: ι₂₃ — light green (pairs with ι₁₄)
  [0.40, 0.60, 0.85],  // 5: ι₂₄ — light blue  (pairs with ι₁₃)
  [0.90, 0.50, 0.35],  // 6: ι₃₄ — light red   (pairs with ι₁₂)
];

export const tetraPaletteForScheme = makePaletteSelector(su21TetraPalette, su21GrayscalePalette);
