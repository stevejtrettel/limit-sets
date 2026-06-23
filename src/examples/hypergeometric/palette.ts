/**
 * Palettes for the hypergeometric demos.
 *
 * The two catalogs walk different alphabets, so they get different palettes:
 *   - orthogonal (degree 5): free-product {T, B, B⁻¹} — 3 generators.
 *   - symplectic (degree 6): free {A, A⁻¹, B, B⁻¹}   — 4 generators.
 * Each is 5 entries so the categoryCount=5 last-gen / kth-last schemes never
 * index out of range (basepoint = slot 0).
 *
 * (Migrated from src/o5/palettes.ts and src/sp6/palettes.ts.)
 */

import { makePaletteSelector } from '../../render/paletteSelector.ts';
import type { Palette } from '../../render/tone.ts';

const grayscalePalette: Palette = [
  [0.35, 0.35, 0.35],
];

/** Orthogonal (free-product): T = warm red, B = cool blue, B⁻¹ = cool teal. */
export const orthogonalPalette: Palette = [
  [0.95, 0.95, 0.95], // 0: basepoint / uncategorized
  [0.65, 0.20, 0.15], // 1: T   — warm red (the reflection)
  [0.10, 0.20, 0.55], // 2: B   — cool blue
  [0.10, 0.40, 0.55], // 3: B⁻¹ — cool teal
  [0.35, 0.35, 0.35], // 4: unused (categoryCount padding)
];

export const paletteForOrthogonal = makePaletteSelector(orthogonalPalette, grayscalePalette);

/** Symplectic (free): A = red, A⁻¹ = amber, B = blue, B⁻¹ = teal. */
export const symplecticPalette: Palette = [
  [0.95, 0.95, 0.95], // 0: basepoint
  [0.75, 0.20, 0.20], // 1: A   — red
  [0.85, 0.55, 0.10], // 2: A⁻¹ — amber
  [0.20, 0.35, 0.75], // 3: B   — blue
  [0.10, 0.55, 0.55], // 4: B⁻¹ — teal
];

export const paletteForSymplectic = makePaletteSelector(symplecticPalette, grayscalePalette);
