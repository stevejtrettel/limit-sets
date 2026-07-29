/**
 * The catalog: which quadratic units t we specialize the ℤ[t,1/t] family at.
 *
 * Each row is one group ⟨A(t), B(t)⟩ ⊂ SL(3, 𝒪_K) together with its Galois
 * embedding into SL(3,ℝ) × SL(3,ℝ) ⊂ SL(6,ℝ). Adding a specialization is one
 * `quadraticUnit(...)` line — the recipe, demo, render script and gates all pick
 * it up. Non-units are rejected at construction (see `quadratic.ts`).
 *
 * Both norm classes are represented on purpose: N(t) = −1 gives t^σ = −1/t, and
 * N(t) = +1 gives t^σ = 1/t (where the conjugate factor is the dual rep).
 */

import { quadraticUnit, type QuadraticUnit, unitPretty } from './quadratic.ts';

export interface GaloisExample {
  id: string;
  label: string;
  description: string;
  unit: QuadraticUnit;
}

const UNITS: readonly QuadraticUnit[] = [
  quadraticUnit('phi',      '(1+√5)/2',  1, 1, 2, 5),   // golden ratio,   N = −1
  quadraticUnit('phi2',     '(3+√5)/2',  3, 1, 2, 5),   // φ²,             N = +1
  quadraticUnit('silver',   '1+√2',      1, 1, 1, 2),   // silver ratio,   N = −1
  quadraticUnit('silver2',  '3+2√2',     3, 2, 1, 2),   // (1+√2)²,        N = +1
  quadraticUnit('sqrt3',    '2+√3',      2, 1, 1, 3),   // fundamental,    N = +1
  quadraticUnit('sqrt13',   '(3+√13)/2', 3, 1, 2, 13),  // fundamental,    N = −1
  quadraticUnit('sqrt6',    '5+2√6',     5, 2, 1, 6),   // fundamental,    N = +1
];

export const EXAMPLES: readonly GaloisExample[] = UNITS.map((u) => ({
  id: u.id,
  label: `t = ${u.label}  (√${u.d}, N = ${u.norm > 0 ? '+1' : '−1'})`,
  description:
    `⟨A(t), B(t)⟩ ⊂ SL(3, ℤ[√${u.d}]) embedded in SL(3,ℝ)×SL(3,ℝ) by γ ↦ (γ, γ^σ); ` +
    `limit set drawn in RP⁵. ${unitPretty(u)}`,
  unit: u,
}));

export function exampleById(id: string): GaloisExample {
  const ex = EXAMPLES.find((e) => e.id === id);
  if (!ex) throw new Error(`unknown galois-sl3 example id: ${id}`);
  return ex;
}
