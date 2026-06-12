/**
 * Build the ping-pong elements of a degree-6 hypergeometric group from its two
 * defining polynomials f, g, following the paper's normal-form construction
 * (background/c-32-5-30.pdf, §1 and §4).
 *
 * Input: the coefficient lists of f and g (monic, length 7), the same
 * `coefflistf` / `coefflistg` the sp6 examples already carry.
 *
 * Recipe (paper §1):
 *   A₀ = companion(f),  B₀ = companion(g)
 *   T₀ = B₀ A₀⁻¹,   v = (T₀ − I) e₀
 *   P  = [ v, −B₀v, B₀²v, −B₀³v, B₀⁴v, −B₀⁵v ]      (the columns)
 *   S  = P⁻¹ B₀ P     — the signed cyclic shift (needs B₀⁶ = −I, i.e. g = x⁶+1)
 *   T  = P⁻¹ T₀ P;    T⁻¹ = P⁻¹ T₀⁻¹ P,  with  T₀⁻¹ = A₀ B₀⁻¹
 *   E  — the fixed involution (ESE = S⁻¹, ETE = T⁻¹); same for the whole family.
 * Branch maps (paper §4):
 *   G₀ = T⁻¹;  for k = 1..5 with εₖ = (−1)^{k+1}:   εₖ T⁻¹Sᵏ   and   εₖ T⁻¹SᵏE.
 *
 * The construction is the only place we leave integers: P⁻¹ and the conjugations
 * are done in floating point, then snapped back with `toInt`, which THROWS if any
 * entry is not within 1e-6 of an integer. Every element here is an integer matrix,
 * so a wrong construction cannot pass silently. The downstream verification
 * (verify.ts) then runs in exact integers.
 */

import { matmul6, invert6, I6 } from './mat6.ts';

export type Mat = number[][];

/** Low-degree-first companion matrix of a monic degree-6 polynomial.
 *  coeffs = [a₀, …, a₆] (a₆ = 1): 1's on the subdiagonal, last column = −(a₀…a₅). */
function companion(coeffs: readonly number[]): Mat {
  const M: Mat = Array.from({ length: 6 }, () => new Array<number>(6).fill(0));
  for (let i = 1; i < 6; i++) M[i][i - 1] = 1;
  for (let i = 0; i < 6; i++) M[i][5] = -coeffs[i];
  return M;
}

/** Snap to integers; throw if any entry is not (within 1e-6) an integer. */
function toInt(M: Mat): Mat {
  return M.map((row) => row.map((x) => {
    const r = Math.round(x);
    if (Math.abs(x - r) > 1e-6) throw new Error(`non-integer entry ${x} in constructed matrix`);
    return r;
  }));
}

const negate = (M: Mat): Mat => M.map((r) => r.map((x) => -x));

/** The fixed involution E in the u-basis (paper §1): e₀↦e₀, eᵢ↦−e_{6−i}. */
const E_FIXED: Mat = [
  [1,  0,  0,  0,  0,  0],
  [0,  0,  0,  0,  0, -1],
  [0,  0,  0,  0, -1,  0],
  [0,  0,  0, -1,  0,  0],
  [0,  0, -1,  0,  0,  0],
  [0, -1,  0,  0,  0,  0],
];

type RO = readonly (readonly number[])[];

/**
 * The eleven maps Gᵢ whose self-containment GᵢK ⊆ K is the cone certificate
 * (paper §3–§4) — these are the paper's "branch maps". Each is a *word* in the
 * three generators S, T⁻¹, E:
 *   G₀ = T⁻¹;   for k = 1..5 with εₖ = (−1)^{k+1}:   εₖ T⁻¹Sᵏ   and   εₖ T⁻¹SᵏE.
 * They are the branches of the contracting generator T⁻¹ over the eleven pieces of
 * the ping-pong target Y ∪ X⁺, so "GᵢK ⊆ K for all eleven" is exactly the inclusion
 * T⁻¹(Y ∪ X⁺) ⊆ X⁺. Given the generators, the maps are just these products — no
 * group construction needed (`buildHyperGroup` only *derives* the generators).
 */
export function coneCertificateMaps(S: RO, Tinv: RO, E: RO): { name: string; G: Mat }[] {
  // product(A, B, C, …) = A·B·C·…  — compose the generators left to right.
  const product = (...factors: RO[]): Mat => factors.reduce<Mat>((acc, M) => matmul6(acc, M), I6);

  // The eleven maps, written out exactly as the paper lists them (§4, p.4). The minus
  // signs are the εₖ — projectively irrelevant; they keep each image in the y₀ > 0 chart.
  return [
    { name: 'G0   T⁻¹',    G: product(Tinv) },
    { name: 'G1   T⁻¹S',   G: product(Tinv, S) },
    { name: 'G2   T⁻¹SE',  G: product(Tinv, S, E) },
    { name: 'G3  −T⁻¹S²',  G: negate(product(Tinv, S, S)) },
    { name: 'G4  −T⁻¹S²E', G: negate(product(Tinv, S, S, E)) },
    { name: 'G5   T⁻¹S³',  G: product(Tinv, S, S, S) },
    { name: 'G6   T⁻¹S³E', G: product(Tinv, S, S, S, E) },
    { name: 'G7  −T⁻¹S⁴',  G: negate(product(Tinv, S, S, S, S)) },
    { name: 'G8  −T⁻¹S⁴E', G: negate(product(Tinv, S, S, S, S, E)) },
    { name: 'G9   T⁻¹S⁵',  G: product(Tinv, S, S, S, S, S) },
    { name: 'G10  T⁻¹S⁵E', G: product(Tinv, S, S, S, S, S, E) },
  ];
}

/** A hypergeometric group in normal form: the generators S, T⁻¹ of Γ' = ⟨S, T⟩,
 *  plus the auxiliary involution E. To get the cone-certificate (branch) maps,
 *  pass these to `coneCertificateMaps(S, Tinv, E)` — a separate construction, not
 *  part of the group itself. */
export interface HyperGroup {
  S: Mat;       // signed cyclic shift   (u-basis) — generator
  Tinv: Mat;    // inverse transvection  (u-basis) — generator
  E: Mat;       // the fixed involution
  P: Mat;       // change of basis (companion ← u); pulls an ambient form Ω in the
                // companion basis to the u-basis by  Ω_U = Pᵀ Ω P
}

/** Derive a hypergeometric group's normal-form generators (S, T⁻¹) and involution
 *  E from its defining polynomials f, g (paper §1). Returns the GROUP only; build
 *  its branch maps separately with `coneCertificateMaps(group.S, group.Tinv, group.E)`. */
export function buildHyperGroup(
  coefflistf: readonly number[],
  coefflistg: readonly number[],
): HyperGroup {
  const A0 = companion(coefflistf);
  const B0 = companion(coefflistg);
  const A0inv = toInt(invert6(A0));            // det = ±1 ⇒ integer
  const B0inv = toInt(invert6(B0));
  const T0    = toInt(matmul6(B0, A0inv));     // T₀   = B₀ A₀⁻¹
  const T0inv = toInt(matmul6(A0, B0inv));     // T₀⁻¹ = A₀ B₀⁻¹

  // v = (T₀ − I) e₀  = first column of (T₀ − I).
  const v = T0.map((row, i) => row[0] - (i === 0 ? 1 : 0));

  // P columns:  colᵢ = (−1)ⁱ B₀ⁱ v,  building B₀ⁱ v iteratively.
  const P: Mat = Array.from({ length: 6 }, () => new Array<number>(6).fill(0));
  let BiV = v.slice();                          // B₀⁰ v = v
  for (let i = 0; i < 6; i++) {
    const sign = (i % 2 === 0) ? 1 : -1;
    for (let r = 0; r < 6; r++) P[r][i] = sign * BiV[r];
    BiV = B0.map((row) => row.reduce((s, m, j) => s + m * BiV[j], 0));   // B₀^{i+1} v
  }
  const Pinv = invert6(P);
  const conjugate = (M: Mat): Mat => toInt(matmul6(matmul6(Pinv, M), P));   // P⁻¹ M P

  const S = conjugate(B0);        // signed shift
  const Tinv = conjugate(T0inv);  // inverse transvection
  const E = E_FIXED;

  return { S, Tinv, E, P };   // generators + change of basis — NOT the maps (see coneCertificateMaps)
}
