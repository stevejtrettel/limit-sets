/**
 * Generic projective chart embedding for limit sets in RP^{n-1}.
 *
 * A chart is a pair (R, d) where R is 3×n, d is an n-vector, and
 *   π(v) = (R · v) / (d · v)   ∈ R³.
 * In the code, the covector d is the `denom` field and the three rows of R are
 * `rows`. The chart-singular hyperplane is {v : |d · v| < EPS_CHART} (where the
 * projective point goes to infinity in this chart); points in it are filtered
 * out at `embed` time.
 *
 * Three fitters:
 *   - axis chart           : d = e_k, R picks 3 of the other (n-1) axes
 *   - chart-PCA            : d = e_k, R = top-3 eigenvectors of the
 *                            centred affine covariance
 *   - auto-chart (PCA)     : d = top eigenvector of (1/N) Σ v vᵀ on S^{n-1},
 *                            R = next three eigenvectors
 *
 * Plus a no-fit constructor `makeChartFromData` for round-tripping from
 * serialised data (view presets, hand-picked charts).
 *
 * Dimension-agnostic: any group whose state vectors live in R^n can reuse all of
 * this. The auto-chart and chart-PCA fitters assume the orbit vectors are
 * NORMALIZED to S^{n-1} (which the projective matrix actions do via
 * GroupAction.normalize); fitting on un-normalized vectors would skew the
 * covariance and give a meaningless chart. The embed loop is a plain
 * `for (let j = 0; j < stateDim; j++)` — V8 inlines it cleanly for small n.
 */

import type { Orbit } from './orbit.ts';
import type { SceneEmbedding } from './scene.ts';
import { jacobiSymmetricEig } from './linalg.ts';

/** Singular-chart tolerance: a point with |d · v| below this is treated as
 *  lying on the chart's hyperplane at infinity and dropped at embed time. */
export const EPS_CHART = 1e-3;

export interface ChartEmbedding extends SceneEmbedding {
  readonly denom: readonly number[];          // length stateDim
  readonly rows:  readonly [readonly number[], readonly number[], readonly number[]]; // 3 × stateDim
  /** Axis index 0..stateDim-1 for axis-aligned charts, -1 otherwise. */
  readonly denomIdx: number;
  readonly isPca: boolean;
  readonly isAutoChart: boolean;
}

// ─── Construction ──────────────────────────────────────────────────────────

interface ChartMeta {
  stateDim: number;
  denom: readonly number[];
  rows:  readonly [readonly number[], readonly number[], readonly number[]];
  label: string;
  pretty: string;
  denomIdx: number;
  isPca: boolean;
  isAutoChart: boolean;
}

function buildEmbed(
  stateDim: number,
  denom: readonly number[],
  rows: readonly [readonly number[], readonly number[], readonly number[]],
) {
  const r0 = rows[0], r1 = rows[1], r2 = rows[2];
  return function embed(
    buf: Float64Array, off: number,
    out: Float64Array, outOff: number,
  ): boolean {
    let dv = 0;
    for (let j = 0; j < stateDim; j++) dv += denom[j] * buf[off + j];
    if (Math.abs(dv) < EPS_CHART) return false;
    const inv = 1 / dv;
    let sx = 0, sy = 0, sz = 0;
    for (let j = 0; j < stateDim; j++) {
      const vj = buf[off + j];
      sx += r0[j] * vj;
      sy += r1[j] * vj;
      sz += r2[j] * vj;
    }
    out[outOff]     = sx * inv;
    out[outOff + 1] = sy * inv;
    out[outOff + 2] = sz * inv;
    return true;
  };
}

function makeChart(meta: ChartMeta): ChartEmbedding {
  return {
    stateDim: meta.stateDim,
    embed: buildEmbed(meta.stateDim, meta.denom, meta.rows),
    denom: meta.denom,
    rows: meta.rows,
    label: meta.label,
    pretty: meta.pretty,
    denomIdx: meta.denomIdx,
    isPca: meta.isPca,
    isAutoChart: meta.isAutoChart,
  };
}

/**
 * Build a ChartEmbedding from raw chart data. Used to round-trip a saved
 * view (where you have the denom + rows on disk and just need an
 * embedding object around them).
 */
export function makeChartFromData(opts: {
  stateDim: number;
  denom: readonly number[];
  rows:  readonly [readonly number[], readonly number[], readonly number[]];
  label?: string;
  pretty?: string;
  denomIdx?: number;
  isPca?: boolean;
  isAutoChart?: boolean;
}): ChartEmbedding {
  if (opts.denom.length !== opts.stateDim) {
    throw new Error(`chart denom has length ${opts.denom.length}, expected stateDim=${opts.stateDim}`);
  }
  for (let r = 0; r < 3; r++) {
    if (opts.rows[r].length !== opts.stateDim) {
      throw new Error(`chart row ${r} has length ${opts.rows[r].length}, expected stateDim=${opts.stateDim}`);
    }
  }
  return makeChart({
    stateDim: opts.stateDim,
    denom: opts.denom,
    rows: opts.rows,
    label: opts.label ?? 'chart',
    pretty: opts.pretty ?? 'chart embedding',
    denomIdx: opts.denomIdx ?? -1,
    isPca: opts.isPca ?? false,
    isAutoChart: opts.isAutoChart ?? false,
  });
}

// ─── Axis-chart embedding ──────────────────────────────────────────────────

/**
 * Axis chart: denom = e_{denomIdx}, rows = e_{projIdxs[0..2]}.
 * Pure index selection; no fitting.
 */
export function makeAxisChartEmbedding(
  stateDim: number,
  denomIdx: number,
  projIdxs: readonly [number, number, number],
): ChartEmbedding {
  const denom = new Array<number>(stateDim).fill(0);
  denom[denomIdx] = 1;
  const rows = projIdxs.map((j) => {
    const r = new Array<number>(stateDim).fill(0);
    r[j] = 1;
    return r as readonly number[];
  }) as [readonly number[], readonly number[], readonly number[]];
  const k1 = denomIdx + 1;
  const a1 = projIdxs.map((j) => j + 1);
  return makeChart({
    stateDim,
    denom,
    rows,
    label: `v${k1}-${a1.join('')}`,
    pretty: `(v${a1[0]}, v${a1[1]}, v${a1[2]}) / v${k1}`,
    denomIdx,
    isPca: false,
    isAutoChart: false,
  });
}

// ─── Chart-PCA (axis-aligned denom; affine PCA for axes) ───────────────────
//
// u(v) = v / (denom · v),  a vector on {y : denom · y = 1}.
// Centred n×n covariance is rank ≤ n-1 with null direction = denom.
// Projection rows: row_i = eig_i − (eig_i · mean) · denom.

function fitPCAInChart(
  orbit: Orbit,
  denom: readonly number[],
): { rows: [number[], number[], number[]] } | null {
  const { vecs, count, stateDim } = orbit;

  const mean = new Array<number>(stateDim).fill(0);
  let kept = 0;
  for (let i = 0; i < count; i++) {
    const off = i * stateDim;
    let dv = 0;
    for (let j = 0; j < stateDim; j++) dv += denom[j] * vecs[off + j];
    if (Math.abs(dv) < EPS_CHART) continue;
    kept++;
    for (let j = 0; j < stateDim; j++) mean[j] += vecs[off + j] / dv;
  }
  if (kept === 0) return null;
  for (let j = 0; j < stateDim; j++) mean[j] /= kept;

  const cov: number[][] = Array.from({ length: stateDim }, () =>
    Array<number>(stateDim).fill(0));
  const u = new Array<number>(stateDim);
  for (let i = 0; i < count; i++) {
    const off = i * stateDim;
    let dv = 0;
    for (let j = 0; j < stateDim; j++) dv += denom[j] * vecs[off + j];
    if (Math.abs(dv) < EPS_CHART) continue;
    for (let j = 0; j < stateDim; j++) u[j] = vecs[off + j] / dv - mean[j];
    for (let a = 0; a < stateDim; a++) {
      for (let b = a; b < stateDim; b++) cov[a][b] += u[a] * u[b];
    }
  }
  for (let a = 0; a < stateDim; a++) {
    for (let b = a; b < stateDim; b++) {
      cov[a][b] /= kept;
      if (a !== b) cov[b][a] = cov[a][b];
    }
  }

  const { vals, vecs: eigvecs } = jacobiSymmetricEig(cov, stateDim);
  const order = vals
    .map((v, i) => ({ v, i }))
    .sort((a, b) => Math.abs(b.v) - Math.abs(a.v))
    .map((x) => x.i);

  const rows: number[][] = [];
  for (let r = 0; r < 3; r++) {
    const e = eigvecs[order[r]];
    let eDotMean = 0;
    for (let j = 0; j < stateDim; j++) eDotMean += e[j] * mean[j];
    const row = new Array<number>(stateDim);
    for (let j = 0; j < stateDim; j++) row[j] = e[j] - eDotMean * denom[j];
    rows.push(row);
  }

  return { rows: rows as [number[], number[], number[]] };
}

/**
 * Like {@link fitPCAChartEmbedding} but with an arbitrary denominator covector
 * (not restricted to a coordinate axis). The 3 projection rows are the top-3
 * PCA axes of the affine cloud inside that denominator's chart. Returns null
 * if no orbit point survives the chart-singular filter. Use this when the
 * chart denominator is a fixed hyperplane in space (e.g. a cone's dominant
 * functional expressed in the current basis) rather than a coordinate index.
 */
export function fitPCAChartEmbeddingWithDenom(
  orbit: Orbit,
  denom: readonly number[],
  label = 'pca',
  pretty = 'PCA chart',
): ChartEmbedding | null {
  if (denom.length !== orbit.stateDim) {
    throw new Error(`denom length ${denom.length} != stateDim ${orbit.stateDim}`);
  }
  const pca = fitPCAInChart(orbit, denom);
  if (!pca) return null;
  return makeChart({
    stateDim: orbit.stateDim,
    denom: denom.slice(),
    rows: pca.rows,
    label,
    pretty,
    denomIdx: -1,
    isPca: true,
    isAutoChart: false,
  });
}

export function fitPCAChartEmbedding(
  orbit: Orbit,
  denomIdx: number,
): ChartEmbedding {
  const { stateDim } = orbit;
  const denom = new Array<number>(stateDim).fill(0);
  denom[denomIdx] = 1;
  const pca = fitPCAInChart(orbit, denom);
  if (!pca) {
    // Fallback: pick three other axes.
    const fallback: number[] = [];
    for (let i = 0; i < stateDim && fallback.length < 3; i++) {
      if (i !== denomIdx) fallback.push(i);
    }
    return makeAxisChartEmbedding(
      stateDim, denomIdx,
      [fallback[0], fallback[1], fallback[2]],
    );
  }
  const k1 = denomIdx + 1;
  return makeChart({
    stateDim,
    denom,
    rows: pca.rows,
    label: `v${k1}-pca`,
    pretty: `PCA on v${k1} chart`,
    denomIdx,
    isPca: true,
    isAutoChart: false,
  });
}

// ─── Auto-chart (projective PCA, single eigendecomposition) ────────────────
//
// Top eigenvector of M = (1/N) Σ v vᵀ on S^{n-1} becomes the chart
// denominator; the next three become the projection rows. The eigenvectors
// of M are mutually orthogonal, so v_2..v_4 already form an orthonormal
// frame inside v_1⊥ — no mean-centring offset is needed in the rows.

export function fitAutoChartEmbedding(orbit: Orbit): ChartEmbedding {
  const { vecs, count, stateDim } = orbit;

  const M: number[][] = Array.from({ length: stateDim }, () =>
    Array<number>(stateDim).fill(0));
  for (let i = 0; i < count; i++) {
    const off = i * stateDim;
    for (let a = 0; a < stateDim; a++) {
      for (let b = a; b < stateDim; b++) M[a][b] += vecs[off + a] * vecs[off + b];
    }
  }
  for (let a = 0; a < stateDim; a++) {
    for (let b = a; b < stateDim; b++) {
      M[a][b] /= count;
      if (a !== b) M[b][a] = M[a][b];
    }
  }

  const { vals, vecs: eigvecs } = jacobiSymmetricEig(M, stateDim);
  const order = vals
    .map((v, i) => ({ v, i }))
    .sort((a, b) => b.v - a.v)
    .map((x) => x.i);

  const v1 = eigvecs[order[0]].slice();
  const v2 = eigvecs[order[1]].slice();
  const v3 = eigvecs[order[2]].slice();
  const v4 = eigvecs[order[3]].slice();

  // Flip v1's sign so the centroid lies on the positive half — keeps the
  // chart denom oriented so π(centroid) is in front of the camera.
  let centroidDotV1 = 0;
  for (let i = 0; i < count; i++) {
    const off = i * stateDim;
    for (let j = 0; j < stateDim; j++) centroidDotV1 += v1[j] * vecs[off + j];
  }
  if (centroidDotV1 < 0) for (let j = 0; j < stateDim; j++) v1[j] = -v1[j];

  return makeChart({
    stateDim,
    denom: v1,
    rows: [v2, v3, v4],
    label: 'autochart',
    pretty: 'auto-chart (projective PCA)',
    denomIdx: -1,
    isPca: true,
    isAutoChart: true,
  });
}
