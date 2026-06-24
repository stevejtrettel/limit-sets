/**
 * Fabi-style affine chart for RP³ → R³ display, parameterised by `t` and a
 * display `scale`.
 *
 * Change of basis E with columns e₁=(1,0,−1,0), e₂=(0,1,0,0), e₃=(1,0,1,t),
 * e₄=(0,0,0,1). E⁻¹ gives denom = (−t/2, 0, −t/2, 1) and rows (½,0,∓½,0) etc.,
 * with `scale` multiplying the three (x,y,z) rows so the limit set is visible.
 * Fabi's original defaults: t = −100, scale = 300.
 */

import { type ChartEmbedding, makeChartFromData } from '../../core/chart.ts';

export const FABI_DEFAULT_T     = -100;
export const FABI_DEFAULT_SCALE = 300;

export function makeFabiChart(t: number, scale: number): ChartEmbedding {
  const d = -t / 2;
  return makeChartFromData({
    stateDim: 4,
    denom: [d, 0, d, 1],
    rows: [
      [0.5 * scale, 0,     -0.5 * scale, 0],
      [0,           scale,  0,           0],
      [0.5 * scale, 0,      0.5 * scale, 0],
    ],
    label: 'fabi',
    pretty: `Fabi's chart — t=${t}, scale=${scale}`,
  });
}
