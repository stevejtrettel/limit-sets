/**
 * Real quadratic units t = (a + b√d)/c, together with their Galois conjugate
 * t^σ = (a − b√d)/c.
 *
 * The specialization of the ℤ[t,1/t]-family in `family.ts` lands in SL(3, 𝒪_K)
 * precisely when t is a unit, i.e.
 *   trace  t + t^σ = 2a/c   ∈ ℤ      and      norm  t · t^σ = (a² − b²d)/c²  = ±1.
 * Both are checked EXACTLY in integer arithmetic at construction, so a non-unit
 * can never reach the catalog (where 1/t would leave the ring and the group
 * would not be a subgroup of SL(3, 𝒪_K)).
 *
 * The two norm classes behave differently downstream and are worth keeping both:
 *   N(t) = −1  ⇒  t^σ = −1/t   (φ, 1+√2)
 *   N(t) = +1  ⇒  t^σ = +1/t   (2+√3, 3+2√2) — here ρ^σ turns out to be the DUAL
 *                 rep ρ*, so the block sum ρ ⊕ ρ^σ preserves the tautological
 *                 pairing on V ⊕ V* and lands in SO(3,3) ⊂ SL(6,ℝ). Pinned by
 *                 scripts/tests/galois-sl3-gates.ts.
 */

export interface QuadraticUnit {
  id: string;
  /** Display form of t, e.g. "(1+√5)/2". */
  label: string;
  /** Squarefree d with K = ℚ(√d). */
  d: number;
  /** t = (a + b√d)/c. */
  a: number;
  b: number;
  c: number;
  /** The real embedding t and its Galois conjugate t^σ = (a − b√d)/c. */
  t: number;
  tSigma: number;
  /** t + t^σ ∈ ℤ. */
  trace: number;
  /** t · t^σ = ±1. */
  norm: 1 | -1;
}

/**
 * Build a unit from exact integer data, verifying integrality and N(t) = ±1 in
 * integer arithmetic. Throws rather than silently admitting a non-unit.
 */
export function quadraticUnit(
  id: string,
  label: string,
  a: number, b: number, c: number, d: number,
): QuadraticUnit {
  if (!Number.isInteger(a) || !Number.isInteger(b) || !Number.isInteger(c) || !Number.isInteger(d)) {
    throw new Error(`quadraticUnit ${id}: a, b, c, d must be integers`);
  }
  if (c === 0) throw new Error(`quadraticUnit ${id}: c must be nonzero`);
  if (d < 2) throw new Error(`quadraticUnit ${id}: d must be ≥ 2 (real quadratic)`);
  for (let k = 2; k * k <= d; k++) {
    if (d % (k * k) === 0) throw new Error(`quadraticUnit ${id}: d = ${d} is not squarefree`);
  }

  if ((2 * a) % c !== 0) {
    throw new Error(`quadraticUnit ${id}: trace 2a/c = ${2 * a}/${c} is not an integer; t is not an algebraic integer`);
  }
  const normNum = a * a - b * b * d;
  if (normNum % (c * c) !== 0) {
    throw new Error(`quadraticUnit ${id}: norm (a²−b²d)/c² = ${normNum}/${c * c} is not an integer`);
  }
  const norm = normNum / (c * c);
  if (norm !== 1 && norm !== -1) {
    throw new Error(
      `quadraticUnit ${id}: N(t) = ${norm} ≠ ±1, so t is not a unit and 1/t ∉ 𝒪_K — ` +
      'the specialized group would not lie in SL(3, 𝒪_K)',
    );
  }

  const root = Math.sqrt(d);
  return {
    id, label, d, a, b, c,
    t: (a + b * root) / c,
    tSigma: (a - b * root) / c,
    trace: (2 * a) / c,
    norm: norm as 1 | -1,
  };
}

/** "ℚ(√5), N(t) = −1" — the one-line arithmetic identity of a unit. */
export const unitPretty = (u: QuadraticUnit): string =>
  `t = ${u.label} ≈ ${u.t.toFixed(6)}, t^σ ≈ ${u.tSigma.toFixed(6)}  ` +
  `[K = ℚ(√${u.d}), tr = ${u.trace}, N = ${u.norm > 0 ? '+1' : '−1'}]`;
