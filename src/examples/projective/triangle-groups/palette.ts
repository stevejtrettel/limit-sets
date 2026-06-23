/**
 * Palette for convex-projective RP² demos.
 *
 * 4-colour palette: basepoint + (M₁, M₂, M₃), with slot 4 (M₄) used by the
 * 4-reflection reps. categoryCount = 5 in the `last-gen` color scheme points
 * here. (Migrated verbatim from src/sl3r/palettes.ts.)
 */

import { makePaletteSelector } from '../../../render/paletteSelector.ts';
import type { Palette } from '../../../render/tone.ts';

export const trianglePalette: Palette = [
  [0.95, 0.95, 0.95],  // 0: basepoint / underflow
  [0.75, 0.20, 0.20],  // 1: M₁ — warm red
  [0.25, 0.60, 0.30],  // 2: M₂ — green
  [0.20, 0.35, 0.75],  // 3: M₃ — blue
  [0.85, 0.55, 0.10],  // 4: M₄ — warm orange (4-reflection reps)
];

export const grayscalePalette: Palette = [
  [0.35, 0.35, 0.35],
];

export const paletteForScheme = makePaletteSelector(trianglePalette, grayscalePalette);
