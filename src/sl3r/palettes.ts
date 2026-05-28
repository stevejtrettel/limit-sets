/**
 * Palettes for SL(3,R) demos.
 *
 * 4-colour palette for 3-reflection Coxeter triangle groups: basepoint +
 * (M₁, M₂, M₃). Slot 4 is padding so the categoryCount = 5 hardcoded in
 * `last-gen` color scheme still has somewhere to point.
 */

import type { Palette } from '../render/tone.ts';

export const sl3rTrianglePalette: Palette = [
  [0.95, 0.95, 0.95],  // 0: basepoint / underflow
  [0.75, 0.20, 0.20],  // 1: R₁ / M₁ — warm red
  [0.25, 0.60, 0.30],  // 2: R₂ / M₂ — green
  [0.20, 0.35, 0.75],  // 3: R₃ / M₃ — blue
  [0.85, 0.55, 0.10],  // 4: R₄       — warm orange  (used by 4-reflection reps)
];

export const sl3rGrayscalePalette: Palette = [
  [0.35, 0.35, 0.35],
];

export function paletteForScheme(schemeName: string): Palette {
  if (schemeName === 'grayscale') return sl3rGrayscalePalette;
  if (schemeName === 'last-gen' || schemeName.startsWith('kth-last:')) {
    return sl3rTrianglePalette;
  }
  return sl3rGrayscalePalette;
}
