/**
 * The Hermitian geometry of complex hyperbolic 2-space, ball model.
 *
 * C^{2,1} is C³ with the signature-(2,1) Hermitian form
 *
 *   ⟨z, w⟩ = z₁w̄₁ + z₂w̄₂ − z₃w̄₃          (J = diag(1, 1, −1))
 *
 * (linear in z, antilinear in w). Negative vectors project to CH² ≅ B⁴ ⊂ C²
 * via (z₁/z₃, z₂/z₃); NULL vectors project to the boundary sphere
 * S³ = {|w₁|² + |w₂|² = 1} = ∂B⁴, where the limit sets live. On the null cone
 * |z₁|² + |z₂|² = |z₃|², so z₃ never vanishes near the cone and the affine
 * chart w = (z₁/z₃, z₂/z₃) is globally good for boundary points.
 *
 * Vectors are flat interleaved C³ ↔ R⁶ Float64Arrays ([Re z₁, Im z₁, …]) —
 * the same layout as the complex-action orbit states.
 *
 * This module carries the form-level vocabulary every construction on CH²
 * needs: the form itself, polar vectors of complex lines (Hermitian "cross
 * product"), the Cartan angular invariant of an ideal triple, and the Cayley
 * translation to Heisenberg coordinates used by the Siegel-domain picture.
 */

import { type CMat, cmat } from '../../core/complexMatrix.ts';
import type { Cx } from '../../core/complexMatrix.ts';

/** Flat interleaved complex 3-vector: [Re z₁, Im z₁, Re z₂, Im z₂, Re z₃, Im z₃]. */
export type CVec3 = Float64Array;

/** Author a C³ vector from three [re, im] pairs. */
export function cvec3(z1: Cx, z2: Cx, z3: Cx): CVec3 {
  return Float64Array.from([z1[0], z1[1], z2[0], z2[1], z3[0], z3[1]]);
}

/** The ball-model form matrix J = diag(1, 1, −1), for g*Jg = J checks. */
export const BALL_FORM: CMat = cmat([
  [[1, 0], [0, 0], [ 0, 0]],
  [[0, 0], [1, 0], [ 0, 0]],
  [[0, 0], [0, 0], [-1, 0]],
]);

/** Diagonal of J, used by entrywise formulas. */
const J_DIAG = [1, 1, -1] as const;

/** ⟨z, w⟩ = z₁w̄₁ + z₂w̄₂ − z₃w̄₃, returned as [re, im]. */
export function herm(z: CVec3, w: CVec3): [number, number] {
  let re = 0, im = 0;
  for (let k = 0; k < 3; k++) {
    const zr = z[2 * k], zi = z[2 * k + 1];
    const wr = w[2 * k], wi = w[2 * k + 1];
    // z_k · conj(w_k)
    re += J_DIAG[k] * (zr * wr + zi * wi);
    im += J_DIAG[k] * (zi * wr - zr * wi);
  }
  return [re, im];
}

/** |⟨z, z⟩| relative to |z|² — 0 exactly on the null cone (boundary points). */
export function nullResidual(z: CVec3): number {
  let norm2 = 0;
  for (let i = 0; i < 6; i++) norm2 += z[i] * z[i];
  if (norm2 === 0) return NaN;
  const [re, im] = herm(z, z);
  return Math.hypot(re, im) / norm2;
}

export const isNullVector = (z: CVec3, tol = 1e-10): boolean => nullResidual(z) < tol;

/**
 * Polar vector of the complex line through p and q: the unique-up-to-scale
 * c with ⟨p, c⟩ = ⟨q, c⟩ = 0, namely c = J⁻¹ · conj(p × q) (bilinear cross
 * product; J real diagonal makes J⁻¹ = J). For p, q distinct null points the
 * polar is a POSITIVE vector (⟨c, c⟩ > 0) and the line is the complex geodesic
 * joining them.
 */
export function polarVector(p: CVec3, q: CVec3): CVec3 {
  const c = new Float64Array(6);
  // x = p × q (bilinear), entry k = p_{k+1} q_{k+2} − p_{k+2} q_{k+1} (mod 3)
  for (let k = 0; k < 3; k++) {
    const a = (k + 1) % 3, b = (k + 2) % 3;
    const xr = (p[2 * a] * q[2 * b] - p[2 * a + 1] * q[2 * b + 1])
             - (p[2 * b] * q[2 * a] - p[2 * b + 1] * q[2 * a + 1]);
    const xi = (p[2 * a] * q[2 * b + 1] + p[2 * a + 1] * q[2 * b])
             - (p[2 * b] * q[2 * a + 1] + p[2 * b + 1] * q[2 * a]);
    // c_k = J_k · conj(x_k)
    c[2 * k]     = J_DIAG[k] * xr;
    c[2 * k + 1] = -J_DIAG[k] * xi;
  }
  return c;
}

/**
 * Cartan angular invariant of an ordered triple of boundary (null) points:
 *   A(p₁, p₂, p₃) = arg(−⟨p₁,p₂⟩⟨p₂,p₃⟩⟨p₃,p₁⟩) ∈ [−π/2, π/2].
 * The complete SU(2,1)-invariant of an ideal triangle. A = 0 ⇔ the triple
 * lies on an R-circle (R-Fuchsian); |A| = π/2 ⇔ it lies on a complex line.
 */
export function cartanInvariant(p1: CVec3, p2: CVec3, p3: CVec3): number {
  const a = herm(p1, p2), b = herm(p2, p3), c = herm(p3, p1);
  const abR = a[0] * b[0] - a[1] * b[1];
  const abI = a[0] * b[1] + a[1] * b[0];
  const tR = abR * c[0] - abI * c[1];
  const tI = abR * c[1] + abI * c[0];
  return Math.atan2(-tI, -tR);
}

/**
 * Cayley translation to the Siegel-domain (second) Hermitian form
 * J₂ = antidiag(1, 1, 1): CAYLEY satisfies CAYLEY* · J₂ · CAYLEY = J EXACTLY,
 * so Z = CAYLEY·z carries ball-model boundary points to J₂-null vectors and
 * Heisenberg coordinates read off as ζ = Z₂/Z₃, v = 2·Im(Z₁/Z₃). The point
 * sent to ∞ is Z₃ = 0 ⇔ z₁ = z₃, i.e. w = (1, 0) ∈ S³.
 */
const R2 = Math.SQRT1_2; // 1/√2
export const CAYLEY: CMat = cmat([
  [[R2, 0], [0, 0], [ R2, 0]],
  [[ 0, 0], [1, 0], [  0, 0]],
  [[R2, 0], [0, 0], [-R2, 0]],
]);
