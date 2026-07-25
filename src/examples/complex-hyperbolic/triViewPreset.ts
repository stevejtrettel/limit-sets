/**
 * On-disk contract between the su21-triangle-groups viewer and its offline
 * render (outputs/presets/su21-tri-view-preset.json). The configuration is
 * continuous: the preset carries the triangle orders and the mirror phase φ
 * verbatim; `exampleId` is a filename slug. Group tag 'su21-tri' (stable).
 */

import type { NamedViewPreset, ViewPresetCamera, ViewPresetViewport } from '../../core/viewPreset.ts';
import type { EmbeddingName } from './viewPreset.ts';
import type { TriangleOrders } from './triangleGroup.ts';

export type { ViewPresetCamera, ViewPresetViewport, EmbeddingName };

export type TriViewPreset = NamedViewPreset & {
  embedding: EmbeddingName;
  orders: TriangleOrders;
  phase: number;
};

/** Filename-safe slug, e.g. "t444_phi5.0738". */
export function triSlug(orders: TriangleOrders, phase: number): string {
  return `t${orders[0]}-${orders[1]}-${orders[2]}_phi${phase.toFixed(4)}`;
}
