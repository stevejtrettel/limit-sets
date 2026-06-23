/**
 * Palettes for SL(2,C) demos.
 *
 * Default 5-colour palette for 2-generator groups: basepoint + (a, a⁻¹) warm
 * pair + (b, b⁻¹) cool pair. Same warm/cool convention as sp6 so the demos
 * read consistently side-by-side.
 *
 * The `last-gen` color scheme registers categoryCount = 5, matching this
 * palette. For groups with more letters (genus 2 closed surface = 4 letters
 * = 9 categories) we'd register a longer scheme + palette and bump the
 * registry's hard 5; not needed for Riley.
 */

import { makePaletteSelector } from '../render/paletteSelector.ts';
import type { Palette } from '../render/tone.ts';

export const sl2cFamilyPalette: Palette = [
  [0.95, 0.95, 0.95],  // 0: basepoint / underflow
  [0.70, 0.20, 0.20],  // 1: a   — warm red
  [0.85, 0.45, 0.15],  // 2: a⁻¹ — warm orange
  [0.15, 0.30, 0.65],  // 3: b   — cool blue
  [0.15, 0.55, 0.65],  // 4: b⁻¹ — cool teal
];

export const sl2cGrayscalePalette: Palette = [
  [0.35, 0.35, 0.35],
];

export const paletteForScheme = makePaletteSelector(sl2cFamilyPalette, sl2cGrayscalePalette);
