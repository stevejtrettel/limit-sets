/**
 * On-disk contract between the kleinian browser viewer and the offline render
 * (scripts/sl2c-view-preset.json). The embeddings (Riemann sphere, stereographic
 * plane) are fixed, parameter-free maps, so the preset just names which to use —
 * the shared `NamedViewPreset` shape from core, with the embedding name narrowed.
 * Group tag stays 'sl2c' so existing saved presets keep loading.
 */

import type { NamedViewPreset, ViewPresetCamera, ViewPresetViewport } from '../../core/viewPreset.ts';

export type { ViewPresetCamera, ViewPresetViewport };

export type EmbeddingName = 'sphere' | 'plane';

export type ViewPreset = NamedViewPreset & { embedding: EmbeddingName };
