/**
 * On-disk contract between the su21 browser viewer and the offline render
 * (outputs/presets/su21-view-preset.json). Both boundary embeddings are fixed,
 * parameter-free maps, so the preset just names which to use — the shared
 * `NamedViewPreset` shape from core with the embedding name narrowed.
 * Group tag is 'su21' (stable identifier; saved presets key off it).
 */

import type { NamedViewPreset, ViewPresetCamera, ViewPresetViewport } from '../../core/viewPreset.ts';

export type { ViewPresetCamera, ViewPresetViewport };

export type EmbeddingName = 'sphere-stereo' | 'heisenberg';

export type ViewPreset = NamedViewPreset & { embedding: EmbeddingName };
