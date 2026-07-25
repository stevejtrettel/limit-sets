/**
 * C-32 ping-pong domain: the coordinate systems it is presented in, the group
 * elements whose translates we draw, and the chart that turns either into a
 * picture. This is the C-32-specific math the viewer and the offline renderer
 * BOTH need — the demo is wiring, so it lives here with the cone data.
 *
 * ─ Coordinates ──────────────────────────────────────────────────────────────
 * The orbit is computed in the companion basis (the recipe's A₀, B₀), giving
 * x ∈ ℝ⁶. A coordinate system is a projective map M: z = M·x. Because a chart
 * reads z_d = (row d of M)·x, the affine patch and the view axes are just
 * SELECTED ROWS of M — one render path, no orbit copy.
 *
 *   companion : M = I      (the paper's A₀, B₀ basis)
 *   u-basis   : M = P⁻¹    (normal form: B₀ → S signed shift, T₀ → T transvection)
 *   rosette   : M = R·P⁻¹  (denominator = the rosette covector u, so ALL SIX
 *                           rotations Sᵏ·K are bounded at once — see ROSETTE_U)
 *
 * Why P⁻¹ and not P: the paper defines P by its COLUMNS,
 *   P = [v, −B₀v, B₀²v, −B₀³v, B₀⁴v, −B₀⁵v],
 * so P's columns are the u-basis vectors written in companion coordinates. Hence
 * x = P·y and y = P⁻¹·x — the transform on *coordinates* is the inverse of the
 * basis matrix. (Cross-check: P⁻¹B₀P = S.) det P = −64; projective, so scale is
 * irrelevant.
 *
 * ─ Copies ───────────────────────────────────────────────────────────────────
 * A copy is a u-basis element g; the copy is the cone g·K. Since g is a linear
 * isomorphism, g·K has the SAME face lattice as K — only the vertices move, so
 * `copyCone(g)` reuses K's 33 facets and 680-edge skeleton via `transformCone`.
 *
 *   base      K
 *   rotated   Sᵏ·K      k=0..5   the six order-6 rotations (the FD rosette)
 *   nested    T⁻¹Sᵏ·K   k=0..5   the branch images, each ⊆ K
 *
 * Whether a copy is DRAWABLE is chart-dependent (`coneBoundedInChart`): in the
 * u-basis e₀ chart only Δ₀ is bounded, so the rotated copies k≠0 escape through
 * infinity there, while the nested copies all sit inside K and are bounded. The
 * `rosette` coordinate system exists for exactly this reason — its denominator
 * is a covector chosen so that all six rotations stay bounded at once.
 */

import { mat, matInverse, matMul, identity, type Mat } from '../../core/matrix.ts';
import { makeChartFromData, type ChartEmbedding } from '../../core/chart.ts';
import { transformCone, type ConvexCone } from '../../core/convex.ts';
import { coneChartPieces, embedRays } from '../../core/convexChart.ts';
import type { SceneEmbedding } from '../../core/scene.ts';
import { c32Cone } from './c32-cone.ts';

// ─── Coordinate systems ──────────────────────────────────────────────────────

/** P (paper p.2): columns are the u-basis vectors in companion coords. */
export const P: readonly (readonly number[])[] = [
  [  0,   5,  11,  14,  11,   5],
  [  5,   0,  -5, -11, -14, -11],
  [-11,  -5,   0,   5,  11,  14],
  [ 14,  11,   5,   0,  -5, -11],
  [-11, -14, -11,  -5,   0,   5],
  [  5,  11,  14,  11,   5,   0],
];

/** Flat core matrix → rows (charts and coordinate systems read row-by-row). */
const toRows = (m: Mat, n = 6): number[][] =>
  Array.from({ length: n }, (_, i) => Array.from(m.subarray(i * n, (i + 1) * n)));

const P_INV_FLAT: Mat = matInverse(mat(P));
const I6: number[][] = toRows(identity(6));
const P_INV: number[][] = toRows(P_INV_FLAT);

// ─── The rosette covector ────────────────────────────────────────────────────
//
// A copy g·K is drawable in the affine patch {u·y = 1} exactly when u·y is
// one-signed and nonzero over its rays; otherwise the copy runs through
// infinity. No COORDINATE patch bounds all six rotations Sᵏ·K at once (the best
// is five of six, in the companion patches) — but a general covector does.
//
// Finding one is a linear feasibility question. Writing εₖ for the sign u takes
// on Sᵏ·K, we need
//     εₖ (u · Sᵏ r) > 0   for every k and every ray r of K,
// i.e. 0 ∉ conv{ εₖ Sᵏ r }. Of the 32 sign patterns (global sign is free) six are
// feasible; the alternating one ε = (+,−,+,−,+,−) — the one S⁶ = −I asks for —
// has the widest margin, and the max-margin covector for it is the min-norm
// point of that convex hull. Rounded to integers:
//
//     u = (5, 11, 14, 11, 5, 1)      normalized margin 0.01846 (optimum 0.01865)
//
// which is |f₅|,…,|f₀| — the coefficient string of f = cyclo(α), absolute values,
// reversed, leading 1 dropped. Suggestive, but taken here only as a convenient
// integer point near the optimum; what is asserted is the exact one-signedness,
// which `scripts/tests/c32-figure-gates.ts` verifies in integer arithmetic over
// all 6 × 254 rays.
export const ROSETTE_U: readonly number[] = [5, 11, 14, 11, 5, 1];

/** The sign u takes on each Sᵏ·K — alternating, as S⁶ = −I forces. */
export const ROSETTE_SIGNS: readonly number[] = [1, -1, 1, -1, 1, -1];

/** Gram–Schmidt: an orthonormal basis of ℝ⁶ whose first vector is `v`. */
function frameFrom(v: readonly number[]): number[][] {
  const basis: number[][] = [];
  const push = (w: number[]): void => {
    for (const b of basis) {
      const d = w.reduce((s, x, i) => s + x * b[i], 0);
      for (let i = 0; i < 6; i++) w[i] -= d * b[i];
    }
    const n = Math.hypot(...w);
    if (n > 1e-9) basis.push(w.map((x) => x / n));
  };
  push(v.slice());
  for (let j = 0; j < 6 && basis.length < 6; j++) {
    const e = new Array(6).fill(0);
    e[j] = 1;
    push(e);
  }
  return basis;
}

// The rosette system's coordinates: z₁ = u·y is the denominator, z₂…z₆ are an
// orthonormal complement, so the view is isotropic rather than sheared. Composed
// with P⁻¹ because the orbit is computed in the companion basis: z = (R·P⁻¹)·x.
const ROSETTE_M: number[][] = toRows(matMul(mat(frameFrom(ROSETTE_U)), P_INV_FLAT));

export interface CoordSystem {
  readonly id: string;
  readonly label: string;
  /** z = M·x: maps companion coords x to this system's coords z (row-major). */
  readonly M: readonly (readonly number[])[];
}

export const COORD_SYSTEMS: readonly CoordSystem[] = [
  { id: 'companion', label: 'companion (A₀, B₀)', M: I6 },
  { id: 'u',         label: 'u-basis (P⁻¹: S, T)', M: P_INV },
  { id: 'rosette',   label: 'rosette (all six Sᵏ·K bounded)', M: ROSETTE_M },
];

export function coordSystemById(id: string): CoordSystem {
  return COORD_SYSTEMS.find((c) => c.id === id) ?? COORD_SYSTEMS[0];
}

/** The notebook's known-good framing: u-basis, patch e₀, axes (z₃, z₅, z₆). */
export const DEFAULT_COORD = 'u';
export const DEFAULT_DENOM = 0;
export const DEFAULT_AXES: readonly [number, number, number] = [2, 4, 5];

/**
 * The ℝ⁶→ℝ³ chart for coordinate system `coordId`, affine patch `denomIdx`, and
 * view-axis triple `axes`. Since z_i = (row i of M)·x, the chart's denominator
 * and numerator rows ARE selected rows of M — the coordinate change, the patch,
 * and the axis choice collapse into one embedding.
 */
export function c32Chart(
  coordId: string = DEFAULT_COORD,
  denomIdx: number = DEFAULT_DENOM,
  axes: readonly [number, number, number] = DEFAULT_AXES,
): ChartEmbedding {
  const sys = coordSystemById(coordId);
  const row = (i: number): number[] => sys.M[i].slice();
  return makeChartFromData({
    stateDim: 6,
    denom: row(denomIdx),
    rows: [row(axes[0]), row(axes[1]), row(axes[2])],
    denomIdx,
    label: `${coordId}-${axes.join('')}-d${denomIdx}`,
    pretty: `${sys.label}: (z${axes[0] + 1}, z${axes[1] + 1}, z${axes[2] + 1}) / z${denomIdx + 1}`,
  });
}

// ─── Group elements (u-basis) ────────────────────────────────────────────────

/** Signed cyclic shift S: S eᵢ = −e_{i+1}, S e₅ = e₀, S⁶ = −I. (Verified P·S = B₀·P.) */
export const S_U: Mat = mat([
  [ 0,  0,  0,  0,  0,  1],
  [-1,  0,  0,  0,  0,  0],
  [ 0, -1,  0,  0,  0,  0],
  [ 0,  0, -1,  0,  0,  0],
  [ 0,  0,  0, -1,  0,  0],
  [ 0,  0,  0,  0, -1,  0],
]);

/** Inverse transvection T⁻¹: row transvection on coordinate 0. */
export const T_INV_U: Mat = mat([
  [1, -5, -11, -14, -11, -5],
  [0,  1,   0,   0,   0,  0],
  [0,  0,   1,   0,   0,  0],
  [0,  0,   0,   1,   0,  0],
  [0,  0,   0,   0,   1,  0],
  [0,  0,   0,   0,   0,  1],
]);

/** Involution E (paper §1): E² = I, ESE = S⁻¹, ETE = T⁻¹. */
export const E_U: Mat = mat([
  [1,  0,  0,  0,  0,  0],
  [0,  0,  0,  0,  0, -1],
  [0,  0,  0,  0, -1,  0],
  [0,  0,  0, -1,  0,  0],
  [0,  0, -1,  0,  0,  0],
  [0, -1,  0,  0,  0,  0],
]);

/** Mᵏ for k ≥ 0 (M⁰ = I). */
function matpow(M: Mat, k: number): Mat {
  let R = identity(6);
  for (let p = 0; p < k; p++) R = matMul(M, R);
  return R;
}

// ─── Copies ──────────────────────────────────────────────────────────────────

export interface Copy {
  label: string;
  /** u-basis transform g (flat core matrix); this copy is the cone g·K. */
  g: Mat;
  edge: number;     // edge / wireframe color
  vertex: number;   // vertex color
  body: number;     // body (silhouette) color
}

/** The three copy families the viewers and figures offer. */
export type CopyMode = 'base' | 'rotated' | 'nested';

// Base K keeps the established two-tone look; the six rotations / branch images
// each get one distinct hue so copies are told apart.
const BASE_EDGE = 0x1f5f87, BASE_VERTEX = 0xe09650, BASE_BODY = 0x3789b8;
const COPY_HUES = [0xd1342b, 0xe8830c, 0x2f9e44, 0x1971c2, 0x7048e8, 0xc2255c];

export function baseCopies(): Copy[] {
  return [{ label: 'K', g: identity(6), edge: BASE_EDGE, vertex: BASE_VERTEX, body: BASE_BODY }];
}

export function rotatedCopies(): Copy[] {
  return [0, 1, 2, 3, 4, 5].map((k) => ({
    label: `S^${k}·K`, g: matpow(S_U, k),
    edge: COPY_HUES[k], vertex: COPY_HUES[k], body: COPY_HUES[k],
  }));
}

export function nestedCopies(): Copy[] {
  return [0, 1, 2, 3, 4, 5].map((k) => ({
    label: `T⁻¹S^${k}·K`, g: matMul(T_INV_U, matpow(S_U, k)),
    edge: COPY_HUES[k], vertex: COPY_HUES[k], body: COPY_HUES[k],
  }));
}

export function copiesFor(mode: CopyMode): Copy[] {
  return mode === 'rotated' ? rotatedCopies() : mode === 'nested' ? nestedCopies() : baseCopies();
}

const P_FLAT = mat(P as number[][]);

/**
 * The drawable cone for a copy: g·K carried into COMPANION coordinates, so it
 * projects through the same chart as the orbit. Rays become P·g·rᵢ; the 33
 * facets and the 680-edge skeleton come along unchanged.
 */
export function copyCone(g: Mat): ConvexCone {
  return transformCone(c32Cone(), matMul(P_FLAT, g));
}

/**
 * The drawable pieces of the copy g·K in `chart`: one body when the copy is
 * bounded there, or the TWO halves running off to opposite sides when it crosses
 * the hyperplane at infinity, each truncated at `extent` chart units. Rays come
 * back in companion coordinates, ready for the same chart as the orbit.
 *
 * The cut is made on K itself, not on the transformed copy: K's 33 facets are
 * exact integers, while `copyCone`'s are floats out of a matrix inverse, and the
 * clipping is exact integer arithmetic. Pulling the chart back through G = P·g
 * is what makes that legal — (d·Gy) = (Gᵀd)·y and (R_a·Gy) = (GᵀR_a)·y, so
 * cutting K in the pulled-back chart and pushing the result forward by G gives
 * exactly the pieces of g·K.
 */
export function copyChartPieces(
  g: Mat, chart: ChartEmbedding, extent: number,
): { rays: number[][]; sign: 1 | -1; clipped: boolean }[] {
  const G = matMul(P_FLAT, g);
  const pull = (cov: readonly number[]): number[] => {
    const out = new Array(6).fill(0);
    for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) out[j] += cov[i] * G[i * 6 + j];
    return out;
  };
  const pieces = coneChartPieces(c32Cone(), {
    denom: pull(chart.denom),
    rows: chart.rows.map(pull),
  }, { extent });

  const push = (y: readonly number[]): number[] => {
    const out = new Array(6).fill(0);
    for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) out[i] += G[i * 6 + j] * y[j];
    return out;
  };
  return pieces.map((piece) => ({
    rays: piece.rays.map(push), sign: piece.sign, clipped: piece.clipped,
  }));
}

/**
 * Truncation half-width for copies that run through infinity, in chart units:
 * a high percentile of the copies' own finite chart coordinates, times
 * `multiple`. A percentile and not a max — rays near the hyperplane blow up, and
 * the box has to be sized by the picture, not by them.
 */
export function copyClipExtent(
  mode: CopyMode, embedding: SceneEmbedding, multiple = 20,
): number {
  const mags: number[] = [];
  for (const copy of copiesFor(mode)) {
    for (const p of embedRays(copyCone(copy.g).rays, embedding)) {
      if (p) mags.push(Math.abs(p[0]), Math.abs(p[1]), Math.abs(p[2]));
    }
  }
  if (mags.length === 0) return multiple;
  mags.sort((a, b) => a - b);
  return (mags[Math.floor(mags.length * 0.6)] || 1) * multiple;
}

export interface CopyPieces {
  copy: Copy;
  pieces: { rays: number[][]; sign: 1 | -1; clipped: boolean }[];
}

// Splitting is exact double description in ℝ⁶ — ~150 ms per copy that actually
// crosses infinity, which is too slow to redo on every camera nudge. Pieces
// depend only on the chart and the truncation box, so they cache on those.
const PIECE_CACHE = new Map<string, CopyPieces[]>();

/**
 * Every copy in `mode`, each as its drawable pieces in `chart`: one body when
 * bounded, two halves when it crosses infinity. Cached per (mode, chart, extent).
 */
export function copiesWithPieces(
  mode: CopyMode, chart: ChartEmbedding, extent: number,
): CopyPieces[] {
  const key = `${mode}|${chart.label}|${extent.toPrecision(6)}`;
  const hit = PIECE_CACHE.get(key);
  if (hit) return hit;
  const out = copiesFor(mode).map((copy) => ({
    copy, pieces: copyChartPieces(copy.g, chart, extent),
  }));
  PIECE_CACHE.set(key, out);
  return out;
}

/**
 * Is this cone inside the chart's affine patch? True iff the denominator
 * covector is one-signed (and nonzero) over its rays — otherwise the copy wraps
 * through infinity in this chart and cannot be drawn.
 */
export function coneBoundedInChart(cone: ConvexCone, chart: ChartEmbedding, eps = 1e-9): boolean {
  let lo = Infinity, hi = -Infinity;
  for (const r of cone.rays) {
    let s = 0;
    for (let j = 0; j < chart.denom.length; j++) s += chart.denom[j] * r[j];
    if (s < lo) lo = s;
    if (s > hi) hi = s;
  }
  return lo > eps || hi < -eps;
}
