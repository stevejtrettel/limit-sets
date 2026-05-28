/**
 * Shared types for SL(4,R) / GL(4,R) limit-set demos.
 *
 * `src/sl4r/` is the library: action.ts, validate.ts, palettes.ts,
 * viewPreset.ts, embedding.ts, and these types. Each demo under demos/
 * owns its own concrete `SL4RExample` values (the matrices, γ word,
 * hand-picked charts, etc.) — see e.g. demos/sl4r-limit-sets/pair1.ts.
 */

import type { Mat4R } from './action.ts';

/**
 * Hand-picked named chart attached to an example. The chart's
 *   π(v) = (rowX·v, rowY·v, rowZ·v) / (denom·v)
 * is the same as a generic core/chart ChartEmbedding; this is just the
 * data, not a fitted object.
 */
export interface CustomChart {
  id: string;
  label: string;
  pretty?: string;
  denom: readonly [number, number, number, number];
  rowX:  readonly [number, number, number, number];
  rowY:  readonly [number, number, number, number];
  rowZ:  readonly [number, number, number, number];
}

export interface SL4RExample {
  id: string;
  label: string;
  description: string;
  generators: readonly Mat4R[];
  /** True for groups whose generators are all involutions. */
  involutions: boolean;
  /** Loxodromic γ word, as a sequence of generator codes (apply order). */
  gamma: readonly number[];
  gammaName: string;
  powerIter: number;
  /** Named hand-picked charts attached to this example. */
  customCharts?: readonly CustomChart[];
}
