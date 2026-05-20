/**
 * Tone-mapping: accumulator (per-pixel category counts) → 8-bit RGBA.
 *
 * Two paths, one fast, one general:
 *
 * 1. **K=1 grayscale** (no palette needed): pure log-tone + bg-inversion.
 *    Dense pixels → black on white bg / white on black bg.
 *
 * 2. **K≥2 categorical** (palette required): per pixel, total = sum(counts[k]).
 *    The tone curve runs on the TOTAL — so brightness reflects overall
 *    density, regardless of categorical mix. The pixel's ink color is the
 *    palette-weighted blend of contributing categories:
 *        ink = Σ (counts[k] / total) · palette[k]
 *    Final pixel is a per-channel lerp from background → ink, parameterized
 *    by tone t.
 *
 * Background (white/black) is purely render-time in BOTH paths. The
 * accumulator is bg-agnostic.
 *
 * Optional `gamma` reshapes the normalized tone t∈[0,1] via t' = t^(1/γ):
 *   γ > 1 boosts low-density tendrils;  γ < 1 does the opposite;  γ = 1 identity.
 */

import type { Accumulator } from './accumulator.ts';

export type RGB = readonly [number, number, number];
export type Palette = ReadonlyArray<RGB>;

export type Bg = 'white' | 'black';

export interface ToneScale {
  clip: number;
  logDenom: number;
  nzCount: number;
}

export interface ToneOptions {
  bg?: Bg;
  gamma?: number;
  palette?: Palette;
}

export interface ToneRGBAOptions extends ToneOptions {
  percentile?: number;
}

/**
 * Compute the percentile-clip value over PER-PIXEL TOTALS.
 *
 * In K=1 the "total" is just the cell value. In K>1 it's the sum across
 * channels for each pixel.
 */
export function computeToneScale(acc: Accumulator, percentile = 0.999): ToneScale {
  if (!(percentile > 0 && percentile <= 1)) {
    throw new Error(`percentile must be in (0, 1] (got ${percentile})`);
  }
  const { data, channels, width, height } = acc;
  const nPixels = width * height;

  // Collect nonzero pixel totals.
  let nz = 0;
  if (channels === 1) {
    for (let i = 0; i < nPixels; i++) if (data[i] > 0) nz++;
  } else {
    for (let i = 0; i < nPixels; i++) {
      let s = 0;
      const base = i * channels;
      for (let c = 0; c < channels; c++) s += data[base + c];
      if (s > 0) nz++;
    }
  }
  const nzArr = new Float32Array(nz);
  let w = 0;
  if (channels === 1) {
    for (let i = 0; i < nPixels; i++) {
      const v = data[i];
      if (v > 0) nzArr[w++] = v;
    }
  } else {
    for (let i = 0; i < nPixels; i++) {
      let s = 0;
      const base = i * channels;
      for (let c = 0; c < channels; c++) s += data[base + c];
      if (s > 0) nzArr[w++] = s;
    }
  }
  nzArr.sort();

  let clip: number;
  if (nz === 0) {
    clip = 1;
  } else {
    const idx = Math.min(nz - 1, Math.max(0, Math.floor(nz * percentile)));
    clip = nzArr[idx];
  }
  return { clip, logDenom: Math.log1p(clip), nzCount: nz };
}

/** Map accumulator cells → 8-bit RGBA pixel data using a pre-computed tone scale. */
export function applyTone(
  acc: Accumulator,
  scale: ToneScale,
  opts: ToneOptions = {},
): Uint8Array {
  const bg: Bg = opts.bg ?? 'white';
  const whiteBg = bg === 'white';
  const gamma = opts.gamma ?? 1;
  if (!(gamma > 0 && Number.isFinite(gamma))) {
    throw new Error(`gamma must be positive (got ${gamma})`);
  }
  const invGamma = 1 / gamma;
  const { width, height, channels, data } = acc;
  const { logDenom } = scale;
  const out = new Uint8Array(width * height * 4);
  const nPixels = width * height;

  // ─── K=1 grayscale fast path ─────────────────────────────────────────────
  if (channels === 1) {
    const bgVal = whiteBg ? 255 : 0;
    for (let i = 0; i < nPixels; i++) {
      const v = data[i];
      let pxVal: number;
      if (v <= 0) {
        pxVal = bgVal;
      } else {
        let t = Math.log1p(v) / logDenom;
        if (t > 1) t = 1;
        if (gamma !== 1) t = Math.pow(t, invGamma);
        pxVal = Math.round(whiteBg ? 255 * (1 - t) : 255 * t);
      }
      const o = i * 4;
      out[o]     = pxVal;
      out[o + 1] = pxVal;
      out[o + 2] = pxVal;
      out[o + 3] = 255;
    }
    return out;
  }

  // ─── K≥2 categorical path: palette compose ────────────────────────────────
  const palette = opts.palette;
  if (!palette || palette.length !== channels) {
    throw new Error(
      `K=${channels} accumulator requires a palette of length ${channels} ` +
      `(got ${palette?.length ?? 'undefined'})`,
    );
  }
  // Flatten palette into typed arrays for tight inner loops.
  const palR = new Float32Array(channels);
  const palG = new Float32Array(channels);
  const palB = new Float32Array(channels);
  for (let c = 0; c < channels; c++) {
    palR[c] = palette[c][0];
    palG[c] = palette[c][1];
    palB[c] = palette[c][2];
  }

  for (let i = 0; i < nPixels; i++) {
    const base = i * channels;
    let total = 0;
    for (let c = 0; c < channels; c++) total += data[base + c];
    const o = i * 4;
    if (total <= 0) {
      const v = whiteBg ? 255 : 0;
      out[o] = v; out[o + 1] = v; out[o + 2] = v; out[o + 3] = 255;
      continue;
    }
    let t = Math.log1p(total) / logDenom;
    if (t > 1) t = 1;
    if (gamma !== 1) t = Math.pow(t, invGamma);
    let inkR = 0, inkG = 0, inkB = 0;
    const invTotal = 1 / total;
    for (let c = 0; c < channels; c++) {
      const wt = data[base + c] * invTotal;
      inkR += wt * palR[c];
      inkG += wt * palG[c];
      inkB += wt * palB[c];
    }
    const bg0 = whiteBg ? 1 : 0;
    const r = bg0 + t * (inkR - bg0);
    const g = bg0 + t * (inkG - bg0);
    const b = bg0 + t * (inkB - bg0);
    out[o]     = Math.round(255 * Math.max(0, Math.min(1, r)));
    out[o + 1] = Math.round(255 * Math.max(0, Math.min(1, g)));
    out[o + 2] = Math.round(255 * Math.max(0, Math.min(1, b)));
    out[o + 3] = 255;
  }
  return out;
}

/** Convenience: accumulator → RGBA in one call. */
export function accumulatorToRGBA(
  acc: Accumulator,
  opts: ToneRGBAOptions = {},
): { rgba: Uint8Array; scale: ToneScale } {
  const scale = computeToneScale(acc, opts.percentile ?? 0.999);
  const rgba = applyTone(acc, scale, { bg: opts.bg, gamma: opts.gamma, palette: opts.palette });
  return { rgba, scale };
}
