/**
 * The EVEN ALL-HALF hypergeometric tower — the symplectic sibling of
 * `all-half-odd.ts`.
 *
 *   Γ_d = ⟨ Comp((x−1)^d), Comp((x+1)^d) ⟩,   d ≥ 4 even
 *
 * Same defining pair of companion matrices, same binomial coefficients; only the
 * parity of d changes. But that parity changes essentially all of the geometry:
 *
 *                      odd d                        even d
 *   T = G·F⁻¹          reflection, T² = I           TRANSVECTION, T² ≠ I
 *   invariant form     symmetric (Toeplitz b_d)     ALTERNATING (Toeplitz a_d)
 *   ambient group      O(m+1, m)                    Sp(d, ℝ)
 *   projective group   (ℤ/2) ∗ ℤ                    F₂ (free of rank 2)
 *   walk               free product {T, B, B⁻¹}     FREE {A, A⁻¹, T, T⁻¹}
 *   quadric            limit set lies on {Q = 0}    NONE — Ω(x,x) ≡ 0
 *
 * The last row matters for drawing: an alternating form is isotropic on every
 * vector, so there is no invariant quadric to constrain or frame the limit set.
 * The picture is a plain RP^{d−1} point cloud, and the Q-orthonormal chart that
 * serves the odd tower has no counterpart here (its symplectic analogue, a
 * Darboux frame, is not canonical in the same way — Sp acts transitively on
 * such frames).
 *
 * ALPHABET. T = G·F⁻¹ is a transvection, not an involution, so there is no
 * free-product structure to exploit and the walk is the plain free group. We
 * generate {A, A⁻¹, T, T⁻¹} rather than {A, A⁻¹, B, B⁻¹} — they generate the same
 * group since B = TA, but T is the geometrically meaningful element (rank-one,
 * (T−I)² = 0) and its inverse is exactly 2I − T, so no matrix inversion is
 * needed for it. The tree is 3^N rather than the odd tower's 2^N, so equal depth
 * costs considerably more.
 *
 * SEEDING is by the explicit word γ = T⁻¹A, for the same reason as the odd
 * tower: both generators are unipotent, so every characteristic root is a d-fold
 * root at ±1, numeric root-finding scatters it (the spurious |λ| reported for A
 * reaches 2.9 by d = 24), and `seedFromLoxodromic` would certify a parabolic as
 * loxodromic. γ = T⁻¹A is proximal at every degree tested (d = 4…30, |λ| growing
 * 11.6 → 86.6) with drift ≤ 1e-16, and its trace is exactly 3d — which also
 * certifies it is not unipotent, since a ±unipotent d×d matrix has trace ±d.
 */

import { type Mat, companion, matInverse, identity, matDim } from '../../core/matrix.ts';
import { makeMatrixAction, type Alphabet } from '../../core/matrixAction.ts';
import { binomialRow, cKernel } from './all-half-kernel.ts';
import type { GroupAction } from '../../core/group.ts';
import { seedFromWord, type Seed } from '../../core/seed.ts';

/** Generator labels in code order. */
export const ALL_HALF_EVEN_LABELS: readonly string[] = ['A', 'A⁻¹', 'T', 'T⁻¹'];

/**
 * Seed word in APPLY ORDER (see core/group.ts): apply A, then T⁻¹. As a group
 * element that is the reversed product T⁻¹·A.
 */
export const ALL_HALF_EVEN_SEED_WORD: readonly number[] = [0, 3];

/** Degrees offered by the family. Even and ≥ 4, as the theorem requires. */
export const DEGREES: readonly number[] = [4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24];

/** Stable per-degree identifier; saved presets key off it. */
export const exampleId = (d: number): string => `allhalf-even-d${d}`;

export interface AllHalfEvenExample {
  id: string;
  label: string;
  /** The degree; the group acts on RP^{d-1} and preserves a symplectic form. */
  d: number;
}

export const EXAMPLES: readonly AllHalfEvenExample[] = DEGREES.map((d) => ({
  id: exampleId(d),
  label: `d = ${d}`,
  d,
}));

const byId = new Map(EXAMPLES.map((e) => [e.id, e]));

export function exampleFor(id: string): AllHalfEvenExample {
  const e = byId.get(id);
  if (!e) throw new Error(`unknown all-half-even id: ${id}`);
  return e;
}

function assertEven(d: number): void {
  if (!Number.isInteger(d) || d < 4 || d % 2 !== 0) {
    throw new Error(`all-half-even: d must be an even integer ≥ 4 (got ${d})`);
  }
}

// ─── The construction ────────────────────────────────────────────────────────

/**
 * The defining polynomials as high-degree-first monic integer coefficient lists.
 * Identical in form to the odd tower — f = (x−1)^d has coeff[i] = (−1)^i C(d,i),
 * g = (x+1)^d has coeff[i] = C(d,i) — the parity of d then decides everything
 * downstream.
 */
export function allHalfEvenPolynomials(d: number): { f: number[]; g: number[] } {
  assertEven(d);
  const c = binomialRow(d);
  return {
    f: c.map((v, i) => (i % 2 === 0 ? v : -v)),
    g: c.slice(),
  };
}

/** The original companion pair F = Comp((x−1)^d), G = Comp((x+1)^d). */
export function allHalfEvenCompanionPair(d: number): { F: Mat; G: Mat } {
  const { f, g } = allHalfEvenPolynomials(d);
  return { F: companion(f), G: companion(g) };
}

/**
 * The symplectic transvection T: the identity except its first row, which is
 * (1, −c_d(1), …, −c_d(d−1)). Equal to G·F⁻¹, but written down directly.
 */
export function transvection(d: number): Mat {
  assertEven(d);
  const T = identity(d);
  for (let j = 1; j < d; j++) T[0 * d + j] = -Number(cKernel(d, j));
  return T;
}

/** T⁻¹ = 2I − T, exactly: (T−I)² = 0, so the Neumann series terminates. */
export function transvectionInverse(T: Mat): Mat {
  const n = matDim(T);
  const out = new Float64Array(T.length);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) out[i * n + j] = (i === j ? 2 : 0) - T[i * n + j];
  }
  return out;
}

/** The normal-form generators A (= F), T, and B = T·A. */
export function allHalfEvenGenerators(d: number): { A: Mat; T: Mat } {
  const { F } = allHalfEvenCompanionPair(d);
  return { A: F, T: transvection(d) };
}

/**
 * The alphabet {A, A⁻¹, T, T⁻¹} with codes 0..3 and inverse [1,0,3,2].
 *
 * Built explicitly rather than through `generatingSet` so the transvection's
 * inverse can be the exact 2I − T instead of a general LU inversion — the one
 * place this family can avoid floating-point inversion entirely.
 */
export function allHalfEvenAlphabet(d: number): Alphabet {
  const { A, T } = allHalfEvenGenerators(d);
  return {
    matrices: [A, matInverse(A), T, transvectionInverse(T)],
    inverse: [1, 0, 3, 2],
  };
}

/** The GroupAction on RP^{d-1}. */
export const allHalfEvenAction = (d: number): GroupAction =>
  makeMatrixAction(allHalfEvenAlphabet(d));

/**
 * Basepoint on the limit set: the attracting fixed point of γ = T⁻¹A. Explicit
 * rather than searched — see the note at the top of this file.
 */
export function seedAllHalfEven(action: GroupAction, iters = 400): Seed {
  return seedFromWord(action, ALL_HALF_EVEN_SEED_WORD, {
    iters,
    labels: ALL_HALF_EVEN_LABELS,
  });
}

/** Rotation tuples (α, β) describing this group in hypergeometric-catalog terms:
 *  α is d copies of 0, β is d copies of ½. For cross-checking only. */
export function allHalfEvenRotations(d: number): { alpha: string[]; beta: string[] } {
  assertEven(d);
  return {
    alpha: Array.from({ length: d }, () => '0'),
    beta: Array.from({ length: d }, () => '1/2'),
  };
}
