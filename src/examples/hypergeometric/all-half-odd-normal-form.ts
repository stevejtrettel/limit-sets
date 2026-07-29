/**
 * The odd all-half tower in its LEVELT NORMAL FORM — the geometric half of the
 * family, exact and integral.
 *
 * `all-half-odd.ts` builds the group as the companion pair (F, G) and computes
 * orbits there, because that basis is numerically well behaved all the way up the
 * tower. What it cannot show you is the GEOMETRY: in companion coordinates the
 * invariant quadratic form is some rational matrix nobody wrote down, and the
 * reflection is an opaque product. This module supplies the other side —
 *
 *     F, G  ──P──▶  A, R   with an explicit integral form Q
 *
 * — following the root-level note `odd-all-half-generators-and-basis-change.md`,
 * whose constructions are all closed-form Pascal data:
 *
 *   u   = (G − F)e_{d−1},  with u_i = −2·C(d,i) for even i and 0 for odd i.
 *         The two companion matrices differ only in their last column, so their
 *         difference has rank one and this single vector spans its image.
 *   P   = [u, Fu, F²u, …, F^{d−1}u], the cyclic basis. Columns are the new basis
 *         vectors IN companion coordinates, so x_comp = P·x_normal.
 *   R   = the identity except for its first row, (−1, −b_d(1), …, −b_d(d−1)).
 *   Q   = the symmetric Toeplitz matrix Q_ij = b_d(|j − i|).
 *
 * where b_d(0) = 2 and b_d(n) = c_d(n) = [z^n]((1+z)/(1−z))^d otherwise. We use
 * the note's finite convolution for c_d rather than a truncated power series, so
 * every entry is one exact BigInt sum.
 *
 * A is NOT computed by conjugation: P is built as a cyclic basis for F, so
 * P⁻¹FP has the same companion entries as F itself. That is a property of cyclic
 * bases, not evidence that the change of basis did nothing — R, Q and the whole
 * geometric picture do change. Equivalently PF = FP, which is what lets the
 * conjugation be certified without inverting anything: P·R·F = G·P.
 *
 * WHY THIS IS NOT USED FOR ORBITS. The b_d(n) grow like n^{d−1}·2^d/(d−1)!, and
 * walking the group in this basis breaks the float seeding path (the
 * characteristic-polynomial route returns NaN from about d = 11). So the division
 * of labour is deliberate: orbits in companion coordinates, geometry from here,
 * and the bridge between them exact rather than floating point.
 */

import {
  type IMat, type FMat, type Signature,
  iident, imul, itranspose, ifromInt, finverse, fclearDenominators, iprimitive,
  idet, signatureOfSymmetricInt, congruenceDiagonalize, fsign, ftoNumber,
} from '../../core/exactMatrix.ts';
import { allHalfOddPolynomials } from './all-half-odd.ts';
import { binom, cKernel, bKernel } from './all-half-kernel.ts';
import type { Orbit } from '../../core/orbit.ts';
import { type ChartEmbedding, fitFrameChart } from '../../core/chart.ts';

// ─── the kernel b_d ──────────────────────────────────────────────────────────
// Shared with the even (symplectic) tower — see `all-half-kernel.ts`. The two
// towers use the SAME c_d and differ only in how it is extended to negative n:
// evenly here (giving a symmetric Q), oddly there (giving an alternating Ω).

export { cKernel, bKernel };

// ─── the normal-form objects ─────────────────────────────────────────────────

/** The companion pair (F, G) as exact integer matrices. */
export function companionPairExact(d: number): { F: IMat; G: IMat } {
  const { f, g } = allHalfOddPolynomials(d);
  const build = (coeff: readonly number[]): IMat => {
    const M: IMat = Array.from({ length: d }, () => Array.from({ length: d }, () => 0n));
    for (let j = 0; j < d - 1; j++) M[j + 1][j] = 1n;
    for (let r = 0; r < d; r++) M[r][d - 1] = -BigInt(coeff[d - r]);
    return M;
  };
  return { F: build(f), G: build(g) };
}

/** u = (G − F)e_{d−1}: spans the image of the rank-one difference. */
export function cyclicVector(d: number): bigint[] {
  const D = BigInt(d);
  return Array.from({ length: d }, (_, i) =>
    (i % 2 === 0 ? -2n * binom(D, BigInt(i)) : 0n));
}

/** P = [u, Fu, …, F^{d−1}u]; columns are the new basis in companion coordinates. */
export function changeOfBasis(d: number): IMat {
  const { F } = companionPairExact(d);
  const P: IMat = Array.from({ length: d }, () => Array.from({ length: d }, () => 0n));
  let v = cyclicVector(d);
  for (let j = 0; j < d; j++) {
    for (let i = 0; i < d; i++) P[i][j] = v[i];
    v = F.map((row) => row.reduce((s, a, k) => s + a * v[k], 0n));
  }
  return P;
}

/** R: the identity except its first row, (−1, −b_d(1), …, −b_d(d−1)). */
export function reflectionNormalForm(d: number): IMat {
  const R = iident(d);
  R[0][0] = -1n;
  for (let j = 1; j < d; j++) R[0][j] = -bKernel(d, j);
  return R;
}

/** The invariant form in the normal basis: Q_ij = b_d(|j − i|). */
export const toeplitzForm = (d: number): IMat =>
  Array.from({ length: d }, (_, i) =>
    Array.from({ length: d }, (_, j) => bKernel(d, Math.abs(j - i))));

/**
 * The normal-form generators. A has the same entries as the companion F (P is a
 * cyclic basis for F); R is the explicit reflection; B = R·A.
 */
export function normalFormGenerators(d: number): { A: IMat; R: IMat; B: IMat } {
  const { F } = companionPairExact(d);
  const R = reflectionNormalForm(d);
  return { A: F, R, B: imul(R, F) };
}

/**
 * The same form pushed back to companion coordinates: Q_comp = P⁻ᵀ Q P⁻¹, scaled
 * to a PRIMITIVE integral matrix (denominators cleared, then the content divided
 * out). Multiplying a form by a nonzero scalar does not change its orthogonal
 * group, so this normalization loses nothing and gives a canonical
 * representative. `scale` records what the returned matrix was multiplied by
 * relative to P⁻ᵀ Q P⁻¹.
 */
export function formInCompanionCoordinates(d: number): { Q: IMat; scale: bigint } {
  const Pinv = finverse(ifromInt(changeOfBasis(d)));
  if (!Pinv) throw new Error(`all-half-odd: change of basis is singular at d = ${d}`);
  const Q = ifromInt(toeplitzForm(d));
  const PinvT = Pinv[0].map((_, j) => Pinv.map((row) => row[j])) as FMat;
  // PinvT · Q · Pinv, over ℚ
  const step = (X: FMat, Y: FMat): FMat =>
    X.map((row) => Y[0].map((_, j) =>
      row.reduce((acc, v, k) => ({
        num: acc.num * (v.den * Y[k][j].den) + v.num * Y[k][j].num * acc.den,
        den: acc.den * v.den * Y[k][j].den,
      }), { num: 0n, den: 1n })));
  const raw = step(step(PinvT, Q), Pinv);
  const cleared = fclearDenominators(raw.map((row) => row.map((v) => {
    const g = v.num === 0n ? v.den : bigGcd(v.num, v.den);
    return { num: v.num / g, den: v.den / g };
  })));
  const prim = iprimitive(cleared.M);
  return { Q: prim.M, scale: cleared.scale / (prim.content === 0n ? 1n : prim.content) };
}

function bigGcd(a: bigint, b: bigint): bigint {
  a = a < 0n ? -a : a; b = b < 0n ? -b : b;
  while (b) { const t = a % b; a = b; b = t; }
  return a;
}

// ─── derived invariants ──────────────────────────────────────────────────────

/** Exact signature of the normal-form Q. */
export const formSignature = (d: number): Signature => signatureOfSymmetricInt(toeplitzForm(d));

/** Exact determinant of the normal-form Q. */
export const formDeterminant = (d: number): bigint => idet(toeplitzForm(d));

/**
 * The reflection walls v_i = A^i e₀, as columns, in NORMAL-FORM coordinates
 * (where they are simply the standard basis vectors, since A e_i = e_{i+1}).
 * Their pairings are Q(v_p, v_q) = b_d(q − p) — the Toeplitz form itself, which
 * is why the walls are the natural frame to draw in.
 */
export const wallGram = (d: number): IMat => toeplitzForm(d);

/** Q-pairings of a normal-form coordinate vector against the walls: Q·x. */
export const pairWithWalls = (d: number, x: readonly bigint[]): bigint[] => {
  const Q = toeplitzForm(d);
  return Q.map((row) => row.reduce((s, v, k) => s + v * x[k], 0n));
};

/** Rows of P⁻¹ as exact rationals: the covectors taking companion coordinates to
 *  normal-form coordinates (x_normal = P⁻¹ x_comp). This is what a chart needs to
 *  display the limit set in the normal-form basis. */
export function normalFormCovectors(d: number): number[][] {
  const Pinv = finverse(ifromInt(changeOfBasis(d)));
  if (!Pinv) throw new Error(`all-half-odd: change of basis is singular at d = ${d}`);
  return Pinv.map((row) => row.map((v) => Number(v.num) / Number(v.den)));
}

/**
 * A Q-ORTHONORMAL frame in companion coordinates: covectors y_0…y_{d−1} in which
 * the invariant form becomes diag(+1,…,+1,−1,…,−1).
 *
 * WHY THIS IS NEEDED. The obvious geometric frames are unusable as charts. The
 * normal-form coordinates ψ = P⁻¹x collapse (after unit-normalizing the rows of
 * P⁻¹, essentially no orbit point survives the chart-singular test beyond about
 * d = 15). The wall pairings φ_i = Q(·, v_i) survive, but adjacent walls are
 * near-perfectly correlated — b_d grows fast enough that φ_{d−1} dominates and
 * the ratios φ_{d−k}/φ_{d−1} degenerate, projecting the limit set onto a LINE
 * (measured 3-D spread 100%/0%/0% from d = 9 up).
 *
 * Both failures are the same problem: the frame is wildly anisotropic in the
 * ambient Euclidean metric even though it is natural in the Q metric. The cure is
 * to whiten by Q, which is the "numerical basis change diagonalizing Q to a
 * standard signature matrix" flagged as a separate step in §14 of the note.
 *
 * The congruence L (with LᵀQ_comp L diagonal) is computed EXACTLY over ℚ; only
 * the final column rescaling by 1/√|dᵢ| is floating point, since those square
 * roots are irrational. Returned covectors are the rows of the inverse frame, so
 * y = (covector_i · x)_i, and Q(x,x) = Σ_{i<pos} y_i² − Σ_{i≥pos} y_i². On the
 * limit set Q(x,x) = 0, so the positive and negative blocks always have equal
 * norm — in particular neither block can vanish.
 */
export interface QFrame { covectors: number[][]; pos: number; neg: number }

// The exact rational congruence is the expensive step (~250ms at d = 25), and
// the frame depends only on d — so it is computed once per degree.
const frameCache = new Map<number, QFrame>();

export function qOrthonormalFrame(d: number): QFrame {
  const hit = frameCache.get(d);
  if (hit) return hit;
  const built = computeQOrthonormalFrame(d);
  frameCache.set(d, built);
  return built;
}

function computeQOrthonormalFrame(d: number): QFrame {
  const { Q } = formInCompanionCoordinates(d);
  const { L, diagonal } = congruenceDiagonalize(ifromInt(Q));
  // Order the columns positive-first so the signature blocks are contiguous.
  const idx = diagonal.map((_, i) => i)
    .filter((i) => fsign(diagonal[i]) !== 0)
    .sort((a, b) => fsign(diagonal[b]) - fsign(diagonal[a]));
  const pos = idx.filter((i) => fsign(diagonal[i]) > 0).length;
  const neg = idx.length - pos;

  // Frame columns, rescaled to unit |Q|-length: L[:,i] / sqrt(|d_i|).
  const Lf = idx.map((i) => {
    const s = 1 / Math.sqrt(Math.abs(ftoNumber(diagonal[i])));
    return L.map((row) => ftoNumber(row[i]) * s);           // column i as a vector
  });
  // Lf is a list of COLUMNS; the covectors are the rows of its inverse.
  const n = idx.length;
  const A: number[][] = Array.from({ length: n }, (_, r) =>
    Array.from({ length: n }, (_, c) => Lf[c][r]));
  const inv = invertFloat(A);
  if (!inv) throw new Error(`all-half-odd: Q-orthonormal frame is singular at d = ${d}`);
  return { covectors: inv, pos, neg };
}

/** Chart in the Q-orthonormal (standard-signature) frame — the geometric view.
 *  The framing machinery itself is the generic `fitFrameChart` in core/chart. */
export const qFrameChart = (orbit: Orbit): ChartEmbedding =>
  fitFrameChart(orbit, qOrthonormalFrame(orbit.stateDim).covectors,
    'qframe', 'Q-orthonormal frame (standard signature)');

/** Chart in the Levelt normal-form coordinates ψ = P⁻¹x. */
export const normalFormChart = (orbit: Orbit): ChartEmbedding =>
  fitFrameChart(orbit, normalFormCovectors(orbit.stateDim),
    'normalform', 'Levelt normal-form coordinates');

/** Plain Gauss-Jordan inverse for the final float rescaling step. */
function invertFloat(A: readonly number[][]): number[][] | null {
  const n = A.length;
  const M = A.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (!Number.isFinite(M[p][c]) || Math.abs(M[p][c]) < 1e-300) return null;
    [M[c], M[p]] = [M[p], M[c]];
    const piv = M[c][c];
    for (let j = 0; j < 2 * n; j++) M[c][j] /= piv;
    for (let r = 0; r < n; r++) {
      if (r === c || M[r][c] === 0) continue;
      const f = M[r][c];
      for (let j = 0; j < 2 * n; j++) M[r][j] -= f * M[c][j];
    }
  }
  return M.map((r) => r.slice(n));
}

/** Sanity helper for gates: P⁻¹ F P should equal F, i.e. P and F commute. */
export const commutesWithA = (d: number): boolean => {
  const { F } = companionPairExact(d);
  const P = changeOfBasis(d);
  return imul(P, F).every((row, i) => row.every((v, j) => v === imul(F, P)[i][j]));
};

/** Congruence check helper: MᵀQM = Q. */
export const preservesForm = (M: IMat, Q: IMat): boolean =>
  imul(imul(itranspose(M), Q), M).every((row, i) => row.every((v, j) => v === Q[i][j]));
