/**
 * Teichmüller space of the once-punctured torus in Fricke / Markov coords.
 *
 * The once-punctured torus group is free on a, b. A discrete faithful rep
 * ρ : F₂ → SL(2, R) with a cusp at the puncture is one whose peripheral
 * commutator [A, B] is parabolic, i.e. tr([A, B]) = −2. By the Fricke
 * identity, the trace coordinates
 *
 *     x = tr(A),   y = tr(B),   z = tr(AB)
 *
 * satisfy
 *
 *     x² + y² + z² − xyz  =  tr([A, B]) + 2  =  0,
 *
 * so the Teichmüller space sits on the Markov cubic surface
 *
 *     x² + y² + z² = xyz.
 *
 * The Teichmüller component (= discrete-faithful reps up to conjugation)
 * is the open set { x, y, z > 2 } ⊂ Markov surface — diffeomorphic to R².
 * The (3, 3, 3) point is the modular torus (classical SL(2, Z) marking).
 *
 * This file is pure math: no DOM, no Three.js, no demo state.
 */

import type { Mat2R } from './hypRep';
import { trace2, det2, mul2, inv2 } from './hypRep';

export type MarkovTriple = readonly [number, number, number];

const TWO_PLUS_EPS = 2 + 1e-9;

/**
 * Given (x, y) on the Teichmüller component of the Markov surface, return
 * the (larger) z that completes them to a Markov triple.
 *
 * Solving z² − xyz + (x² + y²) = 0:
 *     z = (xy ± √(x²y² − 4(x² + y²))) / 2.
 * Admissibility (discriminant ≥ 0) is equivalent to 1/x² + 1/y² ≤ 1/4.
 *
 * Throws on x ≤ 2, y ≤ 2, or admissibility violated — these are caller
 * bugs, not domain inputs.
 */
export function markovTripleFromXY(x: number, y: number): MarkovTriple {
  if (!(x > 2)) {
    throw new Error(`markovTripleFromXY: x=${x} must be > 2 (Teichmüller component)`);
  }
  if (!(y > 2)) {
    throw new Error(`markovTripleFromXY: y=${y} must be > 2 (Teichmüller component)`);
  }
  const disc = x * x * y * y - 4 * (x * x + y * y);
  if (disc < 0) {
    throw new Error(
      `markovTripleFromXY: 1/x² + 1/y² = ${(1 / (x * x) + 1 / (y * y)).toFixed(4)} ` +
      `> 1/4; (x, y) = (${x}, ${y}) lies off the Markov surface (real branch)`,
    );
  }
  const z = (x * y + Math.sqrt(disc)) / 2;
  return [x, y, z] as const;
}

/**
 * Canonical (Markov-style) frame for SL(2, R) matrices A, B with prescribed
 * trace coords (x, y, z):
 *
 *     A = (( x  −1 ),       B = (( 0    ζ   ),     ζ = (z + √(z² − 4)) / 2.
 *          ( 1   0 ))            ( −1/ζ  y  ))
 *
 * One checks
 *     det A = 1,           tr A = x,
 *     det B = ζ·(1/ζ) = 1, tr B = y,
 *     tr AB = ζ + 1/ζ = z,
 * and (via the Fricke identity) tr([A, B]) = x² + y² + z² − xyz − 2,
 * which vanishes to −2 exactly when (x, y, z) is on the Markov surface.
 *
 * Throws if z ≤ 2 (we need ζ real); on the Teichmüller component this
 * never fires.
 */
export function matricesFromMarkov(triple: MarkovTriple): { A: Mat2R; B: Mat2R } {
  const [x, y, z] = triple;
  if (!(z > TWO_PLUS_EPS)) {
    throw new Error(`matricesFromMarkov: z=${z} must be > 2 (need ζ real on Teichmüller component)`);
  }
  const zeta = (z + Math.sqrt(z * z - 4)) / 2;
  const A: Mat2R = [[x, -1], [1, 0]];
  const B: Mat2R = [[0, zeta], [-1 / zeta, y]];
  return { A, B };
}

/**
 * Numerical sanity check. For a rep on the Teichmüller component we expect
 * det A = det B = 1 and tr([A, B]) = −2.
 */
export function verifyRep(
  A: Mat2R, B: Mat2R,
): { detA: number; detB: number; trCommutator: number } {
  const Ai = inv2(A);
  const Bi = inv2(B);
  const commutator = mul2(mul2(mul2(A, B), Ai), Bi);
  return {
    detA: det2(A),
    detB: det2(B),
    trCommutator: trace2(commutator),
  };
}

/**
 * Vieta involution on the Markov surface: replace coordinate `axis` with
 * (product of the other two) − itself. Each is an involution and the three
 * together generate (a finite-index subgroup of) the mapping class group
 * of the once-punctured torus, acting on markings of a fixed hyperbolic
 * structure.
 *
 *   axis 0:  (x, y, z) → (yz − x,  y,       z)
 *   axis 1:  (x, y, z) → (x,       xz − y,  z)
 *   axis 2:  (x, y, z) → (x,       y,       xy − z)
 */
export function vietaMove(triple: MarkovTriple, axis: 0 | 1 | 2): MarkovTriple {
  const [x, y, z] = triple;
  switch (axis) {
    case 0: return [y * z - x, y, z] as const;
    case 1: return [x, x * z - y, z] as const;
    case 2: return [x, y, x * y - z] as const;
  }
}

/**
 * `1/x² + 1/y² ≤ 1/4` is the admissibility constraint for (x, y) on the
 * Teichmüller component. Equivalent to `disc ≥ 0` in `markovTripleFromXY`.
 */
export function isAdmissible(x: number, y: number): boolean {
  return x > 2 && y > 2 && 1 / (x * x) + 1 / (y * y) <= 0.25;
}

/**
 * For given x > 2, the smallest y > 2 such that (x, y) is admissible
 * (1/x² + 1/y² = 1/4). Useful for clamping sliders so they stay on the
 * Markov surface's real branch.
 */
export function minYGivenX(x: number): number {
  if (!(x > 2)) return Infinity;
  return (2 * x) / Math.sqrt(x * x - 4);
}
