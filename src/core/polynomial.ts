/**
 * Rotation numbers → integer polynomials (the hypergeometric construction).
 *
 * A hypergeometric monodromy group is specified by a tuple of rotation numbers
 *   α = (α₁,…,αₙ) ∈ (ℚ/ℤ)ⁿ,
 * and a generator is the companion matrix of
 *   f(x) = ∏ⱼ (x − e^{2πi αⱼ}).
 * When the multiset of rotation numbers is closed under negation mod 1 (roots in
 * conjugate pairs e^{±2πiθ}, plus the fixed points 0 ↦ (x−1) and ½ ↦ (x+1)),
 * f is a *real* polynomial with *integer* coefficients. This module builds that
 * integer coefficient list.
 *
 * The only floating-point step is the complex product; the result is snapped to
 * integers with `snapToInt`, which THROWS if any coefficient is not within
 * `INT_EPS` of an integer — so a malformed tuple (a lone non-conjugate root)
 * cannot pass silently. Output is high-degree-first: `coeffs[i]` is the
 * coefficient of x^{n−i}, with `coeffs[0] = 1`.
 *
 * Pure ability — no example data. Relocated from the old sp6/hypergeometric.ts
 * (which `o5` also reached into); both hypergeometric catalogs now share it here.
 */

/** A rotation number in ℚ/ℤ: the fraction num/den (any integers, den ≠ 0). */
export interface Rotation {
  num: number;
  den: number;
}

const INT_EPS = 1e-6;

/**
 * Parse a rotation number written as a compact string: "0", "1/2", "5/12",
 * or a bare integer. Whitespace tolerated. The raw fraction is preserved
 * (only its angle matters downstream).
 */
export function parseRotation(s: string): Rotation {
  const t = s.trim();
  const slash = t.indexOf('/');
  if (slash === -1) {
    const num = Number(t);
    if (!Number.isInteger(num)) throw new Error(`rotation "${s}" is not an integer or p/q`);
    return { num, den: 1 };
  }
  const num = Number(t.slice(0, slash).trim());
  const den = Number(t.slice(slash + 1).trim());
  if (!Number.isInteger(num) || !Number.isInteger(den) || den === 0) {
    throw new Error(`rotation "${s}" is not a valid p/q`);
  }
  return { num, den };
}

/** Convenience: parse a whole tuple, accepting strings or already-parsed Rotations. */
export function parseRotations(rs: readonly (string | Rotation)[]): Rotation[] {
  return rs.map((r) => (typeof r === 'string' ? parseRotation(r) : r));
}

/** Snap a float to the nearest integer; throw if it is not within INT_EPS. */
function snapToInt(x: number, where: string): number {
  const r = Math.round(x);
  if (Math.abs(x - r) > INT_EPS) {
    throw new Error(`non-integer coefficient ${x} (${where}); rotation tuple is not conjugate-closed`);
  }
  return r;
}

/**
 * Build the integer coefficient list of ∏ⱼ (x − e^{2πi rⱼ}) from the rotation
 * tuple `rots`. Returns length-(n+1) high-degree-first coefficients with leading
 * coefficient 1. Throws if the product is not an integer polynomial.
 */
export function polynomialFromRotations(rots: readonly Rotation[]): number[] {
  // Multiply out with complex coefficients, then snap to integers.
  // coeffs[k] holds the complex coefficient of x^k as [re, im]; start from 1.
  let re = [1];
  let im = [0];
  for (const { num, den } of rots) {
    const theta = (2 * Math.PI * num) / den;
    const rRe = Math.cos(theta);
    const rIm = Math.sin(theta);
    // Multiply current polynomial by (x − root): new[k] = old[k−1] − root·old[k].
    const nRe = new Array<number>(re.length + 1).fill(0);
    const nIm = new Array<number>(im.length + 1).fill(0);
    for (let k = 0; k < re.length; k++) {
      nRe[k + 1] += re[k];
      nIm[k + 1] += im[k];
      nRe[k] -= rRe * re[k] - rIm * im[k];
      nIm[k] -= rRe * im[k] + rIm * re[k];
    }
    re = nRe;
    im = nIm;
  }

  const n = rots.length;
  const coeffs = new Array<number>(n + 1);
  for (let k = 0; k <= n; k++) {
    if (Math.abs(im[k]) > INT_EPS) {
      throw new Error(`non-real coefficient at x^${k} (im=${im[k]}); rotation tuple is not conjugate-closed`);
    }
    coeffs[n - k] = snapToInt(re[k], `x^${k}`); // high-degree-first
  }
  return coeffs;
}

/** Integer coefficient list of ∏(x − e^{2πi rⱼ}) directly from rotation strings
 *  (the hypergeometric polynomial). High-degree-first, leading coefficient 1. */
export function cyclotomicProduct(rots: readonly (string | Rotation)[]): number[] {
  return polynomialFromRotations(parseRotations(rots));
}

/** @deprecated Old name for {@link cyclotomicProduct}; kept for the
 *  sp6/hypergeometric.ts compatibility shim during the refactor. */
export const polynomialFromRotationStrings = cyclotomicProduct;
