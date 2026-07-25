/**
 * On-disk contract between the hypergeometric browser viewers and the offline
 * render scripts (scripts/o5-view-preset.json, scripts/sp6-view-preset.json).
 *
 * Both catalogs fit a projective chart, so the preset carries the chart matrix —
 * the shared `ChartViewPreset` shape from core. Rebuild the embedding from a
 * saved projection with `embeddingFromPreset` (dimension inferred).
 *
 * Group tags stay 'o5' / 'sp6' (see the saveViewPreset calls) so existing saved
 * presets keep loading.
 */

import type {
  ChartViewPreset, ViewPresetCamera, ViewPresetProjection, ViewPresetViewport,
} from '../../core/viewPreset.ts';

export type { ChartViewPreset, ViewPresetCamera, ViewPresetProjection, ViewPresetViewport };

/** The full bundle (alias of the shared ChartViewPreset). */
export type ViewPreset = ChartViewPreset;

/**
 * What the c32 viewer additionally frames: the ping-pong domain layer. The
 * offline renderer reproduces the SAME copies in the same style, so a figure is
 * fully determined by the saved view. Optional — a preset without it renders Λ
 * alone, and CLI flags override it.
 */
export interface C32DomainPreset {
  /** Which family of translates g·K is on screen. */
  copies: 'base' | 'rotated' | 'nested';
  /** How the domain is drawn ('coloring' has no offline equivalent). */
  mode: 'none' | 'wire' | 'wire+body' | 'body' | 'coloring';
  /** Whether wireframe vertices interior to the silhouette are shown. */
  showInterior: boolean;
  /**
   * Which edges the wireframe draws: 'hull' = edges of the projected shadow's
   * 3-D convex hull (the clean outline structure), 'skeleton' = the faithful
   * 1-skeleton of ℙ(K) in ℝⁿ projected (every polytope edge, incl. ones interior
   * in this projection). Optional; absent presets default to 'hull'.
   */
  edges?: 'hull' | 'skeleton';
  /** Overlay the original containing K (faint) behind rotated/nested images. */
  container?: boolean;
}

/** The c32 bundle: a fitted chart view plus the domain layer. */
export interface C32ViewPreset extends ChartViewPreset {
  domain?: C32DomainPreset;
}
