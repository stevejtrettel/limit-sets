/**
 * On-disk contract between the sl7-rp2 browser viewer and its offline render.
 * The RP² embeddings (plane, sphere) are parameter-free fixed maps, so the
 * preset just names which one to use — the shared `NamedViewPreset` shape from
 * core with the embedding name narrowed. Group tag stays 'sl7rp2'.
 */

import type { NamedViewPreset, ViewPresetCamera, ViewPresetViewport } from '../../../core/viewPreset.ts';

export type { ViewPresetCamera, ViewPresetViewport };

export type EmbeddingName = 'plane' | 'sphere';

export type ViewPreset = NamedViewPreset & { embedding: EmbeddingName };
