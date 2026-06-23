/**
 * Standard family-palette dispatch.
 *
 * Every family pairs a categorical `familyPalette` (basepoint + one color per
 * generator, for the `last-gen` / `kth-last:k` schemes) with a single-grey
 * `grayscalePalette` (the `grayscale` scheme). The selection logic is identical
 * everywhere, so each family just supplies its two palettes:
 *
 *   export const paletteForScheme = makePaletteSelector(fooFamilyPalette, fooGrayscalePalette);
 */

import type { Palette } from './tone.ts';

export function makePaletteSelector(
  familyPalette: Palette,
  grayscalePalette: Palette,
): (schemeName: string) => Palette {
  return (schemeName) =>
    schemeName === 'last-gen' || schemeName.startsWith('kth-last:')
      ? familyPalette
      : grayscalePalette;
}
