/**
 * Finite complex hyperbolic triangle groups (n₁₂, n₂₃, n₃₁) — the mirrors
 * meet INSIDE CH² at angles π/n, so the pairwise products ιᵢιⱼ are elliptic
 * of finite order n (the vertex rotations), unlike the ideal case where they
 * are parabolic. Rich Schwartz's (4,4,4) groups are the featured case.
 *
 * CONSTRUCTION (Gram realization, closed form). Normalize the polar vectors
 * to ⟨cᵢ,cᵢ⟩ = 1; the angle condition pins |⟨cᵢ,cⱼ⟩| = cos(π/nᵢⱼ), and the
 * one remaining modulus of the configuration is the PHASE
 *
 *   φ = arg( ⟨c₁,c₂⟩⟨c₂,c₃⟩⟨c₃,c₁⟩ )
 *
 * — the angular invariant of the mirror triple, the exact analogue for
 * mirrors of the Cartan invariant A for ideal vertices. Writing the Gram
 * matrix G (unit diagonal, off-diagonals ρᵢⱼ with the phase on the (1,3)
 * entry), vectors realizing G with signature (2,1) exist iff det G < 0,
 * which bounds φ to the interval `trianglePhaseInterval` around the REAL
 * point φ = π (real Gram ⇒ the classical hyperbolic (n₁₂,n₂₃,n₃₁) reflection
 * group, R-Fuchsian, limit set an R-circle). Realization is a triangular
 * solve: c₁ = e₁; c₂ in span(e₁,e₂); c₃ generic.
 *
 * DISCRETENESS DIAL (Schwartz): the governing words are
 *   W_A = ι₁ι₂ι₁ι₃  ("1213")   and   W_B = ι₁ι₂ι₃  ("123");
 * for small triangles like (4,4,4) it is W_A that degenerates first. When
 * 1213 is parabolic or finite-order elliptic the limit set is the closure of
 * a countable family of R-circles. Use `classifyElement` + `ellipticOrder`
 * on `wordProduct(refl, WORD_1213)`.
 */

import type { GroupAction } from '../../core/group.ts';
import type { CMat } from '../../core/complexMatrix.ts';
import { asComplexInvolutions, makeComplexMatrixAction } from '../../core/complexMatrixAction.ts';
import type { Seed } from '../../core/seed.ts';
import { type CVec3, cvec3 } from './hermitian.ts';
import { complexReflection, seedCH2 } from './recipe.ts';
import {
  classifyElement, ellipticOrder, splittingAngle, wordProduct,
} from './diagnostics.ts';

export type TriangleOrders = readonly [number, number, number];  // n₁₂, n₂₃, n₃₁

export const TRIANGLE_LABELS: readonly string[] = ['ι₁', 'ι₂', 'ι₃'];

/** Schwartz's governing words in APPLY-ORDER codes (the group element is the
 *  reverse product; for involution words, classification is reversal- and
 *  cyclic-invariant, so the display name matches the math). */
export const WORD_1213: readonly number[] = [2, 0, 1, 0];  // ι₁ι₂ι₁ι₃
export const WORD_123: readonly number[]  = [2, 1, 0];     // ι₁ι₂ι₃

const rho = (n: number): number => Math.cos(Math.PI / n);

/**
 * The open interval of valid phases (φmin, 2π − φmin): det G < 0 ⟺
 * cos φ < (ρ₁² + ρ₂² + ρ₃² − 1) / (2ρ₁ρ₂ρ₃). Symmetric about the real point
 * φ = π; the endpoints are degenerate (signature collapses).
 */
export function trianglePhaseInterval(orders: TriangleOrders): [number, number] {
  const [r1, r2, r3] = [rho(orders[0]), rho(orders[1]), rho(orders[2])];
  const bound = (r1 * r1 + r2 * r2 + r3 * r3 - 1) / (2 * r1 * r2 * r3);
  if (bound <= -1) {
    throw new Error(`triangle orders (${orders}) admit no CH² configuration (spherical/euclidean)`);
  }
  if (bound >= 1) return [0, 2 * Math.PI];
  const phiMin = Math.acos(bound);
  return [phiMin, 2 * Math.PI - phiMin];
}

/**
 * Unit polar vectors of the three mirrors with pairwise angles
 * π/n₁₂, π/n₂₃, π/n₃₁ and mirror-triple phase φ. Throws (with the valid
 * interval) if φ is outside `trianglePhaseInterval`.
 */
export function triangleGroupMirrors(
  orders: TriangleOrders, phase: number,
): [CVec3, CVec3, CVec3] {
  const [r12, r23, r31] = [rho(orders[0]), rho(orders[1]), rho(orders[2])];
  // Gram: G₁₂ = ρ₁₂, G₂₃ = ρ₂₃ real; G₁₃ = ρ₃₁·e^{−iφ} so that the triple
  // product ⟨c₁,c₂⟩⟨c₂,c₃⟩⟨c₃,c₁⟩ has argument φ.
  const y = Math.sqrt(1 - r12 * r12);
  const ar = r31 * Math.cos(phase), ai = r31 * Math.sin(phase);  // a = ⟨c₃,c₁⟩ = ρ₃₁e^{iφ}
  const br = (r23 - ar * r12) / y, bi = (-ai * r12) / y;         // from ⟨c₃,c₂⟩ = ρ₂₃
  const f2 = ar * ar + ai * ai + br * br + bi * bi - 1;
  if (!(f2 > 0)) {
    const [lo, hi] = trianglePhaseInterval(orders);
    throw new Error(
      `triangleGroupMirrors: phase ${phase.toFixed(4)} outside the valid interval ` +
      `(${lo.toFixed(4)}, ${hi.toFixed(4)}) for orders (${orders})`,
    );
  }
  return [
    cvec3([1, 0], [0, 0], [0, 0]),
    cvec3([r12, 0], [y, 0], [0, 0]),
    cvec3([ar, ai], [br, bi], [Math.sqrt(f2), 0]),
  ];
}

/** The three complex reflections. */
export function triangleGroupReflections(orders: TriangleOrders, phase: number): CMat[] {
  return triangleGroupMirrors(orders, phase).map((c) => complexReflection(c));
}

/** GroupAction of the (n₁₂, n₂₃, n₃₁) triangle group at mirror phase φ. */
export function triangleGroupAction(orders: TriangleOrders, phase: number): GroupAction {
  return makeComplexMatrixAction(asComplexInvolutions(triangleGroupReflections(orders, phase)));
}

/** Seed on the limit set (vertex rotations are elliptic and skipped by the
 *  loxodromic search automatically). */
export function seedTriangleGroup(action: GroupAction): Seed {
  return seedCH2(action, TRIANGLE_LABELS);
}

// ─── Phase solvers (the special parameters of the family) ───────────────────
//
// Both search the branch (π, φmax); the mirror parameters on (φmin, π) are the
// complex-conjugate representations (same limit set, reflected).

/** The phase where `word` turns PARABOLIC: bisects Goldman's f to 1e-12·scale
 *  on (π, φmax). Null if f does not change sign there. For (4,4,4)/1213 this
 *  is Rich Schwartz's critical φ* ≈ 5.0737560. */
export function findParabolicPhase(
  orders: TriangleOrders, word: readonly number[] = WORD_1213,
): number | null {
  const [, hiI] = trianglePhaseInterval(orders);
  const fAt = (p: number): number =>
    classifyElement(wordProduct(triangleGroupReflections(orders, p), word)).f;
  let lo = Math.PI, hi = hiI - 1e-9;
  if (!(fAt(lo) > 0 && fAt(hi) < 0)) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    (fAt(mid) > 0 ? lo = mid : hi = mid);
  }
  return (lo + hi) / 2;
}

export interface EllipticPhase {
  phase: number;
  /** The eigenvalue splitting angle at the solution (= 2π/n by construction). */
  splitting: number;
  /** VERIFIED projective order of the word there (ellipticOrder); null means
   *  the other eigenvalue ratio is irrational — elliptic but infinite order. */
  order: number | null;
}

/**
 * The phase past φ* where `word` is ELLIPTIC with eigenvalue splitting angle
 * exactly 2π/n — the order-n candidates of Schwartz's R-circle-closure
 * regime, accumulating at φ* as n → ∞. Bisects the splitting angle on
 * (φ*, φmax); null if 2π/n exceeds the splitting reached at the wall (n too
 * small) or if no parabolic phase exists. The returned `order` is verified
 * independently, not assumed.
 */
export function findEllipticPhase(
  orders: TriangleOrders, n: number, word: readonly number[] = WORD_1213,
): EllipticPhase | null {
  const phiC = findParabolicPhase(orders, word);
  if (phiC === null) return null;
  const [, hiI] = trianglePhaseInterval(orders);
  const target = (2 * Math.PI) / n;
  const M = (p: number): CMat => wordProduct(triangleGroupReflections(orders, p), word);
  const deltaAt = (p: number): number => splittingAngle(M(p));
  let lo = phiC + 1e-9, hi = hiI - 1e-9;
  if (!(deltaAt(lo) < target && deltaAt(hi) > target)) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    (deltaAt(mid) < target ? lo = mid : hi = mid);
  }
  const phase = (lo + hi) / 2;
  return {
    phase,
    splitting: deltaAt(phase),
    order: ellipticOrder(M(phase), Math.max(400, 4 * n)),
  };
}
