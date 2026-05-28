/**
 * Duality polynomial ψ and the curve γ_{c,d} ⊂ Θ parametrising Anosov
 * representations in the Barbot component.
 *
 * For (c, d) ∈ (-1, 1)² \ {(0,0)} fixed, ψ(a, b, c, d) = 0 is the locus
 * of (a, b) for which the Z/3 ∗ Z/3 representation extends to the full
 * modular group (i.e. admits a duality). γ_{c,d} is a smooth arc in Θ
 * starting at (a, b) = (1, 1) (the Pappus point).
 *
 * Source: Schwartz, "On Pappus and Anosov Representations of the
 * Modular Group" §5.3 (the polynomial) and §6 (the curve).
 *
 * Practical: for each fixed b ≥ 1 we solve ψ(·, b, c, d) = 0 for the
 * unique a ∈ S_b on the Anosov branch (Lemma 6.3). Brent on a bracketed
 * interval; the bracket [1/2, 2] from Lemma 6.4 always contains γ_{c,d}.
 */

/**
 * ψ(a, b, c, d) — the duality polynomial. Vanishes on γ_{c,d}.
 *   ψ = (a² - 1)(b² + 1)(a²b² + a² + ab² - a + b² + 1)(c² + d² - 2c²d²)
 *     + a(b² - 1)(a²b² + a² + 2ab² - 4ab - 2a + b² + 1) · cd(c² - d²)
 *
 * Properties (used downstream):
 *   ψ(1, 1, c, d) = 0      — Pappus is on the curve.
 *   ψ(1/a, b, d, c) = -ψ(a, b, c, d) — inverse symmetry.
 */
export function dualityPsi(a: number, b: number, c: number, d: number): number {
  const a2 = a * a, b2 = b * b, c2 = c * c, d2 = d * d;
  const term1Factor1 = (a2 - 1) * (b2 + 1);
  const term1Factor2 = a2 * b2 + a2 + a * b2 - a + b2 + 1;
  const term1Factor3 = c2 + d2 - 2 * c2 * d2;
  const term1 = term1Factor1 * term1Factor2 * term1Factor3;

  const term2Factor1 = a * (b2 - 1);
  const term2Factor2 = a2 * b2 + a2 + 2 * a * b2 - 4 * a * b - 2 * a + b2 + 1;
  const term2Factor3 = c * d * (c2 - d2);
  const term2 = term2Factor1 * term2Factor2 * term2Factor3;

  return term1 + term2;
}

// ─── Brent's method (bracketed scalar root finder) ──────────────────────────

/**
 * Brent's method on a continuous scalar f over [lo, hi] with f(lo)·f(hi) < 0.
 * Returns the unique-ish root to tol. Standard textbook combination of
 * bisection, secant, and inverse quadratic interpolation; converges
 * super-linearly for smooth f and gracefully (bisection) otherwise.
 */
function brent(
  f: (x: number) => number,
  lo: number, hi: number,
  tol: number = 1e-12,
  maxIter: number = 100,
): number {
  let a = lo, b = hi;
  let fa = f(a), fb = f(b);
  if (fa * fb > 0) {
    throw new Error(
      `brent: root not bracketed; f(${a})=${fa}, f(${b})=${fb}`,
    );
  }
  if (Math.abs(fa) < Math.abs(fb)) { [a, b] = [b, a]; [fa, fb] = [fb, fa]; }
  let c = a, fc = fa;
  let d = b - a;
  let e = d;
  let mflag = true;

  for (let iter = 0; iter < maxIter; iter++) {
    if (fb === 0 || Math.abs(b - a) < tol) return b;

    let s: number;
    if (fa !== fc && fb !== fc) {
      // Inverse quadratic interpolation.
      s = a * fb * fc / ((fa - fb) * (fa - fc))
        + b * fa * fc / ((fb - fa) * (fb - fc))
        + c * fa * fb / ((fc - fa) * (fc - fb));
    } else {
      // Secant.
      s = b - fb * (b - a) / (fb - fa);
    }

    const cond1 = (s - (3 * a + b) / 4) * (s - b) > 0;
    const cond2 = mflag && Math.abs(s - b) >= Math.abs(b - c) / 2;
    const cond3 = !mflag && Math.abs(s - b) >= Math.abs(c - d) / 2;
    const cond4 = mflag && Math.abs(b - c) < tol;
    const cond5 = !mflag && Math.abs(c - d) < tol;
    if (cond1 || cond2 || cond3 || cond4 || cond5) {
      s = (a + b) / 2;
      mflag = true;
    } else {
      mflag = false;
    }

    const fs = f(s);
    d = c; c = b; fc = fb;
    if (fa * fs < 0) { b = s; fb = fs; }
    else             { a = s; fa = fs; }
    if (Math.abs(fa) < Math.abs(fb)) { [a, b] = [b, a]; [fa, fb] = [fb, fa]; }
  }
  return b;
}

// ─── The good-parameter slice S_b (Lemma 5.1) ──────────────────────────────

/**
 * The slice S_b = { a : (a, b) ∈ Θ } from Lemma 5.1.
 *   - b ∈ (1, 1+√2):  S_b = ((1+2b-b²)/(b²+1), (b²+1)/(1+2b-b²))
 *   - b ≥ 1+√2:       S_b = (0, ∞)
 *   - b = 1:          S_b degenerates to {1} (handled at call site).
 *
 * For b ≥ 1+√2, the upper endpoint formula's denominator (1+2b-b²)
 * becomes ≤ 0, so the slice is unbounded; we return Infinity.
 */
function sliceSb(b: number): { lo: number; hi: number } {
  const SQRT2 = Math.SQRT2; // √2 ≈ 1.4142
  if (b >= 1 + SQRT2) return { lo: 0, hi: Infinity };
  const num = b * b + 1;
  const den = 1 + 2 * b - b * b; // > 0 in (1, 1+√2)
  return { lo: den / num, hi: num / den };
}

// ─── Anosov-branch solver for a(b; c, d) ────────────────────────────────────

/**
 * Solve ψ(a, b, c, d) = 0 for a, returning the Anosov-branch root.
 *
 * Bracketing strategy (combining two paper facts to guarantee both
 * existence and uniqueness inside the bracket):
 *
 *   - Lemma 6.3: ψ = 0 exactly once in S_b (the good-parameter slice).
 *   - Lemma 6.4 Remark: γ_{c,d} ⊂ [1/2, 2] × [1, ∞) for all (c, d), and
 *     ⊂ [1, 2] × [1, ∞) for 0 ≤ c ≤ d.
 *
 * Together: the Anosov root lives in intersect(S_b, [1/2, 2]). This is
 * always a finite bracket and contains exactly that one root (the wider
 * [1/2, 2] alone would risk picking up a non-Anosov elliptic root in
 * [1/2, 2] \ S_b when b is small, since Lemma 6.3 only constrains S_b).
 *
 * Sign at the bracket endpoints. Lemma 6.2 proves ψ < 0 at S_b's left
 * endpoint and ψ > 0 at S_b's right endpoint, so the unique Anosov root
 * lies strictly inside S_b with the standard sign pattern. After
 * intersecting with [1/2, 2] (subset of S_b once the root is inside),
 * the signs at the intersection endpoints stay (-, +).
 */
export function solveDualityA(
  b: number, c: number, d: number,
): number {
  if (b === 1) return 1;
  if (b < 1) {
    throw new Error(`solveDualityA: b = ${b} < 1; the duality curve has b ≥ 1`);
  }

  // Anosov bound (Lemma 6.4 Remark): [1/2, 2] in general; [1, 2] for 0 ≤ c ≤ d.
  const anosovLo = (c >= 0 && d >= 0 && c <= d) ? 1 : 0.5;
  const anosovHi = 2;

  // Intersect with S_b (Lemma 5.1) to invoke Lemma 6.3's uniqueness.
  const Sb = sliceSb(b);
  const lo = Math.max(anosovLo, Sb.lo);
  const hi = Math.min(anosovHi, Sb.hi);

  if (!(lo < hi)) {
    throw new Error(
      `solveDualityA: empty bracket for (b, c, d) = (${b}, ${c}, ${d}); ` +
      `Anosov=[${anosovLo},${anosovHi}], S_b=(${Sb.lo},${Sb.hi})`,
    );
  }

  const f = (a: number): number => dualityPsi(a, b, c, d);
  const flo = f(lo);
  const fhi = f(hi);

  if (flo === 0) return lo;
  if (fhi === 0) return hi;

  if (flo * fhi > 0) {
    throw new Error(
      `solveDualityA: no sign change in bracket [${lo}, ${hi}] for ` +
      `(b, c, d) = (${b}, ${c}, ${d}); ψ(lo)=${flo.toExponential(2)}, ` +
      `ψ(hi)=${fhi.toExponential(2)}. Anosov root should be in this bracket ` +
      `per Lemma 6.4 Remark — this indicates a bug.`,
    );
  }

  return brent(f, lo, hi);
}
