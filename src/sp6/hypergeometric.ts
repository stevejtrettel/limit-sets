/**
 * Hypergeometric rotation-numbers → palindromic integer polynomials.
 *
 * A degree-6 hypergeometric monodromy group (the sp6 "companion matrix" family,
 * Bajpai–Doña–Nitsche Tables 1–2) is specified by two parameter tuples
 *   α = (α₁,…,α₆),   β = (β₁,…,β₆)   of rotation numbers in ℚ/ℤ,
 * and its two generators are the companion matrices of
 *   f(x) = ∏ⱼ (x − e^{2πi αⱼ}),   g(x) = ∏ⱼ (x − e^{2πi βⱼ}).
 *
 * When the multiset of rotation numbers is closed under negation mod 1 (which
 * it always is for these tables — the roots come in conjugate pairs e^{±2πiθ},
 * plus the fixed points 0 ↦ (x−1) and ½ ↦ (x+1)), f is a *real* polynomial with
 * *integer* coefficients, and being a product of self-reciprocal factors it is
 * palindromic. This module builds that integer coefficient list from α, deriving
 * the data the rest of sp6 consumes (`coefflistf`, `coefflistg`) instead of
 * hand-transcribing seven integers per generator per group.
 *
 * The only floating-point step is the complex product; the result is snapped to
 * integers with `snapToInt`, which THROWS if any coefficient is not within
 * `INT_EPS` of an integer — so a malformed α (e.g. a lone non-conjugate root)
 * cannot pass silently. Output is high-degree-first: `coeffs[i]` is the
 * coefficient of x^{6−i}, with `coeffs[0] = coeffs[6] = 1`. (These polynomials
 * are palindromic, so the convention is moot for f,g themselves, but we fix it
 * for determinism and to match the existing `EXAMPLES` lists.)
 */

/** A rotation number in ℚ/ℤ: the fraction num/den (any integers, den ≠ 0). */
export interface Rotation {
  num: number;
  den: number;
}

const INT_EPS = 1e-6;

/**
 * Parse a rotation number written as a compact string: "0", "1/2", "5/12",
 * or a bare integer. Whitespace tolerated. The value is taken mod 1, but the
 * raw fraction is preserved (only its angle matters downstream).
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
 * Build the palindromic integer coefficient list of
 *   ∏ⱼ (x − e^{2πi rⱼ})
 * from the rotation tuple `rots`. Returns length-(n+1) high-degree-first
 * coefficients with leading coefficient 1. Throws if the product is not an
 * integer polynomial (i.e. the rotation multiset is not closed under negation).
 */
export function polynomialFromRotations(rots: readonly Rotation[]): number[] {
  // Multiply out with complex coefficients, then snap to integers.
  // coeffs[k] holds the complex coefficient of x^k as [re, im]; start with the
  // constant polynomial 1.
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
      // + old[k]·x  → shifts to index k+1
      nRe[k + 1] += re[k];
      nIm[k + 1] += im[k];
      // − root·old[k]  at index k   (complex multiply root·old[k])
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
    // High-degree-first: coeffs[i] = coefficient of x^{n−i}.
    coeffs[n - k] = snapToInt(re[k], `x^${k}`);
  }
  return coeffs;
}

/** Build the integer coefficient list directly from a tuple of rotation strings. */
export function polynomialFromRotationStrings(rots: readonly (string | Rotation)[]): number[] {
  return polynomialFromRotations(parseRotations(rots));
}
