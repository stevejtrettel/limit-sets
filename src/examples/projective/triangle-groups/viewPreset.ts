/**
 * On-disk contract between the RP² browser viewer and the offline render script
 * (JSON at scripts/sl3r-view-preset.json, written by the dev-server middleware).
 *
 * The embeddings (sphere, plane) are parameter-free fixed maps, so the preset
 * just names which one to use — no chart data to round-trip. This is the shared
 * `NamedViewPreset` shape from core, with the embedding name narrowed.
 *
 * The group tag stays 'sl3r' (see saveViewPreset call in the demo) so existing
 * saved presets keep loading.
 */

import type { NamedViewPreset, ViewPresetCamera, ViewPresetViewport } from '../../../core/viewPreset.ts';

export type { ViewPresetCamera, ViewPresetViewport };

export type EmbeddingName = 'sphere' | 'plane';

export type ViewPreset = NamedViewPreset & { embedding: EmbeddingName };
