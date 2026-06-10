/**
 * C-32 ping-pong cone + the basis in which we draw everything.
 *
 * We work in the paper's *normal-form (u-)basis*, where B₀ becomes the signed
 * cyclic shift S and T₀ the transvection T (see the "Thinness of C-32" note +
 * background/c32_dual_cone_certificate_verifier.py). The 254 extremal rays of
 *   K = { y ∈ R⁶ : H y ≥ 0 }
 * in `c32-extremal-rays.json` (the `num_rays` + `rays` slice of
 * `background/c32_extremal_rays.json`, left untouched as the full
 * source-of-truth certificate output) are already in this basis, so they need
 * no transform — we just draw them where they are.
 *
 * The demo's limit-set orbit is generated in the *companion basis* (the repo's
 * makeSp6Action gens are exactly the paper's A₀, B₀). To put the orbit in the
 * same picture as the rays we conjugate it into the u-basis by
 *
 *     y = P⁻¹ · x,
 *
 * where P is the integer change of basis whose columns are (−1)ⁱ B₀ⁱ v with
 * v = (T₀ − I)e₀, T₀ = B₀A₀⁻¹ (paper p.2 / verifier's `U`). It is verified
 * exactly: P⁻¹B₀P = signed shift, P⁻¹T₀P = transvection, det P = −64.
 *
 * Charting is projective and scale-invariant, so the −64 determinant and any
 * per-vector scale are irrelevant; we unit-normalize for numeric tidiness.
 * The natural affine chart in this basis sets the dominant coordinate y₀ = 1
 * (ℙ(K°) ⊆ the dominance chamber Δ₀ = {|y₀| > |yⱼ|}), i.e. denom = e₀.
 */

import raysData from './c32-extremal-rays.json';

/** Companion-basis ← u-basis change of basis. (Columns = (−1)ⁱ B₀ⁱ v.) */
export const P_COMPANION_FROM_U: readonly (readonly number[])[] = [
  [  0,   5,  11,  14,  11,   5],
  [  5,   0,  -5, -11, -14, -11],
  [-11,  -5,   0,   5,  11,  14],
  [ 14,  11,   5,   0,  -5, -11],
  [-11, -14, -11,  -5,   0,   5],
  [  5,  11,  14,  11,   5,   0],
];

/** The 254 extremal rays of K, in the u-basis (raw integer coordinates). */
export const RAYS_U: readonly (readonly number[])[] =
  raysData.rays as readonly (readonly number[])[];

export const NUM_RAYS: number = raysData.num_rays;

/**
 * The 77 facet normals of K (rows of H): K = { y : H·y ≥ 0 } in the u-basis.
 * Used to test cone membership — note ℙ(K) is a *strict* convex subset of the
 * dominance chamber Δ₀, so "in Δ₀" ≠ "in K".
 */
export const FACETS_H: readonly (readonly number[])[] =
  raysData.facets as readonly (readonly number[])[];

// ─── u ← companion conjugation (P⁻¹), computed once from the integer P ───────

function invert6(M: readonly (readonly number[])[]): number[][] {
  const n = 6;
  const a = M.map((r) => r.slice());
  const inv: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r;
    [a[c], a[p]] = [a[p], a[c]];
    [inv[c], inv[p]] = [inv[p], inv[c]];
    const pv = a[c][c];
    for (let j = 0; j < n; j++) { a[c][j] /= pv; inv[c][j] /= pv; }
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = a[r][c];
      if (f === 0) continue;
      for (let j = 0; j < n; j++) { a[r][j] -= f * a[c][j]; inv[r][j] -= f * inv[c][j]; }
    }
  }
  return inv;
}

/** u-basis ← companion-basis change of basis: y = P_U_FROM_COMPANION · x. */
export const P_U_FROM_COMPANION: readonly (readonly number[])[] =
  invert6(P_COMPANION_FROM_U);

/**
 * The order-6 element (paper §1). In the u-basis it is the signed cyclic shift
 * S: Se_i = -e_{i+1} (0≤i≤4), Se₅ = e₀, with S⁶ = -I, S¹² = I — so projectively
 * order 6, and S Δ_i = Δ_{i+1} cycles the six dominance chambers. In the
 * companion/old basis the same element is B₀ = P·S·P⁻¹ = companion(g=x⁶+1),
 * also order 6 (B₀⁶ = -I). Use order6Matrix(basisU) to get the right one.
 */
export const S_U: readonly (readonly number[])[] = [
  [ 0,  0,  0,  0,  0,  1],
  [-1,  0,  0,  0,  0,  0],
  [ 0, -1,  0,  0,  0,  0],
  [ 0,  0, -1,  0,  0,  0],
  [ 0,  0,  0, -1,  0,  0],
  [ 0,  0,  0,  0, -1,  0],
];
export const B0_COMPANION: readonly (readonly number[])[] = [
  [ 0,  0,  0,  0,  0, -1],
  [ 1,  0,  0,  0,  0,  0],
  [ 0,  1,  0,  0,  0,  0],
  [ 0,  0,  1,  0,  0,  0],
  [ 0,  0,  0,  1,  0,  0],
  [ 0,  0,  0,  0,  1,  0],
];
export function order6Matrix(basisU: boolean): readonly (readonly number[])[] {
  return basisU ? S_U : B0_COMPANION;
}

/**
 * The *inverse* transvection T⁻¹ (paper §1, §4). The branch maps T⁻¹Sᵏ pull the
 * copies SᵏX⁺ back inside the cone: T⁻¹(Y ∪ X⁺) ⊆ X⁺ ⊆ K. (T itself pushes the
 * other way, toward the E-reflected copy X⁻ outside K — so the move *into* the
 * hull is T⁻¹.) In the u-basis T⁻¹ is the row transvection
 *   T⁻¹y = (y₀ − 5y₁ − 11y₂ − 14y₃ − 11y₄ − 5y₅, y₁, …, y₅);
 * in the companion/old basis it is T₀⁻¹ = A₀B₀⁻¹ (= I − c·e₀ᵀ, c the seed col).
 */
export const T_INV_U: readonly (readonly number[])[] = [
  [1, -5, -11, -14, -11, -5],
  [0,  1,   0,   0,   0,   0],
  [0,  0,   1,   0,   0,   0],
  [0,  0,   0,   1,   0,   0],
  [0,  0,   0,   0,   1,   0],
  [0,  0,   0,   0,   0,   1],
];
export const T0_INV_COMPANION: readonly (readonly number[])[] = [
  [  1, 0, 0, 0, 0, 0],
  [ -5, 1, 0, 0, 0, 0],
  [ 11, 0, 1, 0, 0, 0],
  [-14, 0, 0, 1, 0, 0],
  [ 11, 0, 0, 0, 1, 0],
  [ -5, 0, 0, 0, 0, 1],
];
export function transvectionInv(basisU: boolean): readonly (readonly number[])[] {
  return basisU ? T_INV_U : T0_INV_COMPANION;
}

/**
 * The cone's dominant hyperplane, as a denominator covector in the active
 * basis. K lives strictly in {y₀ > 0} (the dominance inequalities force
 * y₀ > |yⱼ|), so the u-basis covector e₀ is interior to the dual cone K* —
 * the canonical "always-valid" chart denominator for the hull picture.
 *
 * In the companion basis the *same* physical hyperplane is e₀∘P⁻¹ = the first
 * row of P⁻¹, since (P⁻¹x)₀ = y₀. Using this (rather than companion-coord 0,
 * which slices straight through the cone) keeps the ray hull honest in the
 * original/old view too. Returns a fresh array each call.
 */
export function dominantDenom(basisU: boolean): number[] {
  if (basisU) return [1, 0, 0, 0, 0, 0];
  return P_U_FROM_COMPANION[0].slice();
}

/**
 * Test whether the projective point at (buf, off) lies in the cone ℙ(K),
 * i.e. H·y ≥ 0 for some sign of the representative. `basisU` says which basis
 * the buffer is in: u-basis → test directly; companion basis → convert to
 * u-coordinates (y = P⁻¹x) first, since K is defined in the u-basis.
 *
 * The convex-combination argument (cone denom y₀ > 0 on every ray) guarantees
 * that a point passing this test projects *inside* the convex hull of the
 * projected rays in any y₀=1 (denom = e₀) chart — which is exactly the
 * containment the picture should show.
 */
const _y = new Float64Array(6);
export function inCone(buf: Float64Array, off: number, basisU: boolean): boolean {
  if (basisU) {
    for (let i = 0; i < 6; i++) _y[i] = buf[off + i];
  } else {
    const Pi = P_U_FROM_COMPANION;
    for (let i = 0; i < 6; i++) {
      let yi = 0;
      const ri = Pi[i];
      for (let j = 0; j < 6; j++) yi += ri[j] * buf[off + j];
      _y[i] = yi;
    }
  }
  // Orient the representative so the dominant-coordinate side is positive
  // (K lives in {y₀ > 0}); then require every facet inequality H·y ≥ 0.
  const sign = _y[0] >= 0 ? 1 : -1;
  for (let r = 0; r < FACETS_H.length; r++) {
    const h = FACETS_H[r];
    let dot = 0;
    for (let j = 0; j < 6; j++) dot += h[j] * _y[j];
    if (sign * dot < -1e-9) return false;
  }
  return true;
}

/**
 * Conjugate an orbit's state vectors from the companion basis into the
 * u-basis in place (y = P⁻¹x), re-unit-normalizing each. After this the orbit
 * lives in the same coordinates as the rays.
 */
export function conjugateOrbitToU(vecs: Float64Array, count: number): void {
  const Pi = P_U_FROM_COMPANION;
  const tmp = new Float64Array(6);
  for (let k = 0; k < count; k++) {
    const off = k * 6;
    let s = 0;
    for (let i = 0; i < 6; i++) {
      let yi = 0;
      const ri = Pi[i];
      for (let j = 0; j < 6; j++) yi += ri[j] * vecs[off + j];
      tmp[i] = yi;
      s += yi * yi;
    }
    const inv = s > 0 ? 1 / Math.sqrt(s) : 1;
    for (let i = 0; i < 6; i++) vecs[off + i] = tmp[i] * inv;
  }
}

/**
 * The extremal rays as unit vectors in the u-basis: a flat Float64Array of
 * length NUM_RAYS · 6. No basis change — they're already where we draw when
 * the orbit is conjugated into the u-basis. Pairs with `conjugateOrbitToU`.
 */
export function raysUnit(): Float64Array {
  return packRays((y, out, off) => {
    for (let i = 0; i < 6; i++) out[off + i] = y[i];
  });
}

/**
 * The extremal rays mapped into the *companion* basis (x = P·y), unit vectors.
 * Use when drawing in the original (old-demo) coordinates: the orbit stays in
 * the companion basis and the rays come to it.
 */
export function raysCompanion(): Float64Array {
  const P = P_COMPANION_FROM_U;
  return packRays((y, out, off) => {
    for (let i = 0; i < 6; i++) {
      let xi = 0;
      const Pi = P[i];
      for (let j = 0; j < 6; j++) xi += Pi[j] * y[j];
      out[off + i] = xi;
    }
  });
}

/** Shared packer: write each ray via `fill`, then unit-normalize the block. */
function packRays(fill: (y: readonly number[], out: Float64Array, off: number) => void): Float64Array {
  const n = RAYS_U.length;
  const out = new Float64Array(n * 6);
  for (let k = 0; k < n; k++) {
    const off = k * 6;
    fill(RAYS_U[k], out, off);
    let s = 0;
    for (let i = 0; i < 6; i++) s += out[off + i] * out[off + i];
    if (s > 0) {
      const inv = 1 / Math.sqrt(s);
      for (let i = 0; i < 6; i++) out[off + i] *= inv;
    }
  }
  return out;
}
