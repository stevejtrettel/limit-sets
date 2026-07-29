/**
 * The kernel shared by both all-half towers.
 *
 * Odd and even all-half groups are the same construction at different parities
 * of d, and they draw on the SAME generating function:
 *
 *     c_d(n) = [z^n] ((1+z)/(1−z))^d
 *
 * What differs is how c_d is extended to negative n, and that choice is exactly
 * what makes the invariant form symmetric or alternating:
 *
 *   odd  d → the EVEN extension   b_d(0) = 2, b_d(±n) = +c_d(n)
 *            ⇒ Q_ij = b_d(j−i) is symmetric      ⇒ orthogonal group, a reflection
 *   even d → the ODD extension    a_d(0) = 0, a_d(±n) = ±c_d(n)
 *            ⇒ Ω_ij = a_d(j−i) is alternating    ⇒ symplectic group, a transvection
 *
 * So the parity of d selects the parity of the kernel, which selects the whole
 * geometry. This module owns the piece both share.
 *
 * c_d(n) is evaluated by the finite convolution of (1+z)^d with (1−z)^{−d},
 *
 *     c_d(n) = Σ_{k=0..min(d,n)} C(d,k) · C(d+n−k−1, n−k),
 *
 * one exact BigInt sum per coefficient — rather than by truncating a power
 * series, whose length would have to be guessed and whose entries grow fast
 * (c_d(n) ~ n^{d−1}·2^d/(d−1)!).
 */

/** Binomial coefficient, exact. Returns 0 outside 0 ≤ k ≤ n. */
export function binom(n: bigint, k: bigint): bigint {
  if (k < 0n || k > n) return 0n;
  let r = 1n;
  for (let i = 0n; i < k; i++) r = (r * (n - i)) / (i + 1n);
  return r;
}

/** Binomial row C(d,0..d) as safe JS integers; throws if precision would be lost. */
export function binomialRow(d: number): number[] {
  const D = BigInt(d);
  const row: number[] = [];
  for (let i = 0; i <= d; i++) {
    const v = Number(binom(D, BigInt(i)));
    if (!Number.isSafeInteger(v)) {
      throw new Error(`all-half: C(${d},${i}) exceeds the safe integer range`);
    }
    row.push(v);
  }
  return row;
}

/** c_d(n) = [z^n] ((1+z)/(1−z))^d, for n ≥ 0. Exact. */
export function cKernel(d: number, n: number): bigint {
  if (n < 0) throw new Error(`cKernel: n must be ≥ 0 (got ${n})`);
  const D = BigInt(d);
  let total = 0n;
  for (let k = 0; k <= Math.min(d, n); k++) {
    total += binom(D, BigInt(k)) * binom(D + BigInt(n - k) - 1n, BigInt(n - k));
  }
  return total;
}

/** Even extension — the ORTHOGONAL (odd d) kernel: b_d(0) = 2, b_d(n) = c_d(|n|). */
export const bKernel = (d: number, n: number): bigint =>
  (n === 0 ? 2n : cKernel(d, Math.abs(n)));

/** Odd extension — the SYMPLECTIC (even d) kernel: a_d(0) = 0, a_d(−n) = −a_d(n). */
export const aKernel = (d: number, n: number): bigint =>
  (n === 0 ? 0n : n > 0 ? cKernel(d, n) : -cKernel(d, -n));
