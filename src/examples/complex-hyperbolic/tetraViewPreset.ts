/**
 * On-disk contract between the su21-tetrahedra research viewer and its
 * offline render (outputs/presets/su21-tetra-view-preset.json).
 *
 * Unlike catalog families, the configuration here is CONTINUOUS — the preset
 * carries the moduli (A, ζ, v) and the active generator set verbatim.
 * `exampleId` is a human-readable moduli slug (used for render filenames);
 * the moduli numbers are authoritative. Group tag is 'su21-tetra' (stable).
 */

import type { NamedViewPreset, ViewPresetCamera, ViewPresetViewport } from '../../core/viewPreset.ts';
import type { EmbeddingName } from './viewPreset.ts';

export type { ViewPresetCamera, ViewPresetViewport, EmbeddingName };

export interface TetraModuli {
  /** Cartan invariant of the base face p₁p₂p₃. */
  A: number;
  /** p₄ in Heisenberg coordinates. */
  zx: number;
  zy: number;
  v: number;
}

export type GeneratorSet = 'tetra' | 'quad';

export type TetraViewPreset = NamedViewPreset & {
  embedding: EmbeddingName;
  moduli: TetraModuli;
  generators: GeneratorSet;
};

/** Filename-safe moduli slug, e.g. "A0.600_z0.900+0.350i_v0.800_tetra". */
export function moduliSlug(m: TetraModuli, gens: GeneratorSet): string {
  const n = (x: number): string => x.toFixed(3).replace('-', 'm');
  return `A${n(m.A)}_z${n(m.zx)}+${n(m.zy)}i_v${n(m.v)}_${gens}`;
}
