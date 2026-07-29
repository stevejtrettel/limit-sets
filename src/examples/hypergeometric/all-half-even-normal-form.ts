/**
 * The even all-half tower's normal form and its alternating invariant form —
 * exact and integral, following `even-all-half-limit-set-implementation.md`.
 *
 *   u   = (G − F)e_{d−1},  with u_i = −2·C(d,i) for ODD i and 0 for even i.
 *         (The odd tower's u is the same formula with the parities swapped —
 *         that single swap is what turns a reflection into a transvection.)
 *   P   = [u, Fu, F²u, …, F^{d−1}u], the cyclic basis; x_comp = P·x_normal.
 *   T   = identity except its first row (1, −c_d(1), …, −c_d(d−1)).
 *   Ω   = the alternating Toeplitz matrix Ω_ij = a_d(j−i).
 *
 * As in the odd case, P is a cyclic basis for F, so P⁻¹FP has the same companion
 * entries as F — meaning PF = FP, and the conjugation T = P⁻¹GF⁻¹P can be
 * certified inverse-free as P·T·F = G·P.
 *
 * WHAT IS GENUINELY DIFFERENT. Ω is ALTERNATING, so Ω(x,x) = 0 for every x.
 * There is no invariant quadric: the limit set is not confined to a
 * hypersurface, and the Q-orthonormalization that conditions the odd tower's
 * charts has no counterpart. A symplectic form does admit a Darboux normal form
 * (all symplectic forms of a given rank are equivalent), but precisely because
 * of that there is no canonical Darboux frame — Sp(d,ℝ) acts transitively on
 * them — so unlike the orthogonal signature there is no invariant to read off.
 * `symplecticFrame` below supplies one anyway, for conditioning rather than for
 * geometry, and is labelled as such.
 */

import {
  type IMat, type FMat,
  iident, imul, itranspose, iequal, ifromInt, finverse, fclearDenominators, iprimitive,
  idet, irank,
} from '../../core/exactMatrix.ts';
import { binom, aKernel, cKernel } from './all-half-kernel.ts';
import { allHalfEvenPolynomials } from './all-half-even.ts';
import type { Orbit } from '../../core/orbit.ts';
import { type ChartEmbedding, fitFrameChart } from '../../core/chart.ts';

export { aKernel, cKernel };

// ─── the normal-form objects ─────────────────────────────────────────────────

/** The companion pair (F, G) as exact integer matrices. */
export function companionPairExact(d: number): { F: IMat; G: IMat } {
  const { f, g } = allHalfEvenPolynomials(d);
  const build = (coeff: readonly number[]): IMat => {
    const M: IMat = Array.from({ length: d }, () => Array.from({ length: d }, () => 0n));
    for (let j = 0; j < d - 1; j++) M[j + 1][j] = 1n;
    for (let r = 0; r < d; r++) M[r][d - 1] = -BigInt(coeff[d - r]);
    return M;
  };
  return { F: build(f), G: build(g) };
}

/** u = (G − F)e_{d−1}: −2C(d,i) on ODD i, zero on even i. */
export function cyclicVector(d: number): bigint[] {
  const D = BigInt(d);
  return Array.from({ length: d }, (_, i) =>
    (i % 2 === 0 ? 0n : -2n * binom(D, BigInt(i))));
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

/** T as an exact integer matrix: identity except the first row. */
export function transvectionExact(d: number): IMat {
  const T = iident(d);
  for (let j = 1; j < d; j++) T[0][j] = -cKernel(d, j);
  return T;
}

/** T⁻¹ = 2I − T, exact. */
export const transvectionInverseExact = (T: IMat): IMat =>
  T.map((row, i) => row.map((v, j) => (i === j ? 2n : 0n) - v));

/** The invariant ALTERNATING form: Ω_ij = a_d(j−i). */
export const alternatingForm = (d: number): IMat =>
  Array.from({ length: d }, (_, i) =>
    Array.from({ length: d }, (_, j) => aKernel(d, j - i)));

/** The normal-form generators: A (same entries as F), the transvection T, B = TA. */
export function normalFormGenerators(d: number): { A: IMat; T: IMat; B: IMat } {
  const { F } = companionPairExact(d);
  const T = transvectionExact(d);
  return { A: F, T, B: imul(T, F) };
}

/**
 * Ω pushed back to companion coordinates: Ω_comp = P⁻ᵀ Ω P⁻¹, normalized to a
 * primitive integral matrix. Scaling an alternating form by a nonzero scalar
 * does not change its symplectic group, so the normalization is free.
 */
export function formInCompanionCoordinates(d: number): { Omega: IMat; scale: bigint } {
  const Pinv = finverse(ifromInt(changeOfBasis(d)));
  if (!Pinv) throw new Error(`all-half-even: change of basis is singular at d = ${d}`);
  const Om = ifromInt(alternatingForm(d));
  const PinvT = Pinv[0].map((_, j) => Pinv.map((row) => row[j])) as FMat;
  const step = (X: FMat, Y: FMat): FMat =>
    X.map((row) => Y[0].map((_, j) =>
      row.reduce((acc, v, k) => {
        const n = acc.num * (v.den * Y[k][j].den) + v.num * Y[k][j].num * acc.den;
        const dd = acc.den * v.den * Y[k][j].den;
        const g = n === 0n ? dd : gcd(n, dd);
        return { num: n / g, den: dd / g };
      }, { num: 0n, den: 1n })));
  const raw = step(step(PinvT, Om), Pinv);
  const cleared = fclearDenominators(raw);
  const prim = iprimitive(cleared.M);
  return { Omega: prim.M, scale: cleared.scale / (prim.content === 0n ? 1n : prim.content) };
}

function gcd(a: bigint, b: bigint): bigint {
  a = a < 0n ? -a : a; b = b < 0n ? -b : b;
  while (b) { const t = a % b; a = b; b = t; }
  return a;
}

// ─── checks / derived facts ──────────────────────────────────────────────────

/** MᵀΩM = Ω, exactly. */
export const preservesForm = (M: IMat, Om: IMat): boolean =>
  iequal(imul(imul(itranspose(M), Om), M), Om);

/** Is the form alternating (Ωᵀ = −Ω with zero diagonal)? */
export const isAlternating = (Om: IMat): boolean =>
  Om.every((row, i) => row.every((v, j) => v === -Om[j][i])) && Om.every((row, i) => row[i] === 0n);

/** Rank of Ω — must be d (nondegenerate) for a symplectic form. */
export const formRank = (d: number): number => irank(alternatingForm(d));

/** Determinant of Ω. For a nondegenerate alternating form this is a perfect
 *  square (the square of the Pfaffian). */
export const formDeterminant = (d: number): bigint => idet(alternatingForm(d));

/** Rows of P⁻¹ as floats: covectors taking companion coordinates to normal-form
 *  coordinates (x_normal = P⁻¹ x_comp), for charts. Cached per degree. */
const covectorCache = new Map<number, number[][]>();
export function normalFormCovectors(d: number): number[][] {
  const hit = covectorCache.get(d);
  if (hit) return hit;
  const Pinv = finverse(ifromInt(changeOfBasis(d)));
  if (!Pinv) throw new Error(`all-half-even: change of basis is singular at d = ${d}`);
  const out = Pinv.map((row) => row.map((v) => Number(v.num) / Number(v.den)));
  covectorCache.set(d, out);
  return out;
}

/**
 * Chart in the Levelt normal-form coordinates ψ = P⁻¹x.
 *
 * This is the ONLY geometric frame the even tower offers. The odd tower also has
 * a Q-orthonormal frame, built by congruence-diagonalizing its symmetric form to
 * diag(±1) — a canonical construction, because the signature is an invariant.
 * Here the form is alternating, every symplectic form of full rank is equivalent
 * to the standard one, and Sp(d,ℝ) acts transitively on Darboux frames. So a
 * "symplectic frame" would be an arbitrary choice, carrying no more information
 * than the plain auto-chart. We do not offer one.
 */
export const normalFormChart = (orbit: Orbit): ChartEmbedding =>
  fitFrameChart(orbit, normalFormCovectors(orbit.stateDim),
    'normalform', 'Levelt normal-form coordinates');
