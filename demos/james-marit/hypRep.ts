/**
 * Hyperbolic SL(2, R) representation of the once-punctured torus group
 * F₂ = ⟨a, b⟩. Just a pair of 2×2 matrices plus a few helpers
 * (translation length, trace, determinant) and some small linear algebra.
 */

export type Mat2R = readonly [readonly [number, number], readonly [number, number]];

export interface HyperbolicRep {
  a: Mat2R;
  b: Mat2R;
}

export function mul2(a: Mat2R, b: Mat2R): Mat2R {
  return [
    [a[0][0] * b[0][0] + a[0][1] * b[1][0],  a[0][0] * b[0][1] + a[0][1] * b[1][1]],
    [a[1][0] * b[0][0] + a[1][1] * b[1][0],  a[1][0] * b[0][1] + a[1][1] * b[1][1]],
  ];
}

/** Cofactor inverse; caller is responsible for `det m ≠ 0`. */
export function inv2(m: Mat2R): Mat2R {
  const d = det2(m);
  const inv = 1 / d;
  return [
    [ m[1][1] * inv, -m[0][1] * inv],
    [-m[1][0] * inv,  m[0][0] * inv],
  ];
}

export function trace2(m: Mat2R): number {
  return m[0][0] + m[1][1];
}

export function det2(m: Mat2R): number {
  return m[0][0] * m[1][1] - m[0][1] * m[1][0];
}

/**
 * Hyperbolic translation length 2 · acosh(|tr|/2).
 * Returns 0 (rather than NaN) when |tr| ≤ 2 so caller code stays simple;
 * the demo should display "—" in that case and warn separately.
 */
export function translationLength(m: Mat2R): number {
  const t = Math.abs(trace2(m)) / 2;
  if (t <= 1) return 0;
  return 2 * Math.acosh(t);
}

/**
 * Canonical modular-torus representation (the (3, 3, 3) point on the Markov
 * surface) given by explicit integer matrices. tr(a) = tr(b) = tr(ab) = 3,
 * det(a) = det(b) = 1, tr([a, b]) = -2. Used as the default rep in the
 * james-marit demo; the alternative is to parametrise (x, y) on the
 * Teichmüller component via markovTripleFromXY (see teichmuller.ts).
 *
 * Verified at module load (see assertion below) to be a discrete-faithful
 * Fuchsian rep of the once-punctured torus group:
 *   - det(A) = det(B) = 1            (SL(2,R))
 *   - |tr(A)|, |tr(B)| > 2           (both hyperbolic → translation axes)
 *   - tr([A, B]) = -2                (parabolic peripheral commutator,
 *                                     i.e. the puncture)
 *   - axes intersect in H²           (Fuchsian intersecting-axes picture
 *                                     of the once-punctured torus)
 */
export const DEFAULT_REP: HyperbolicRep = {
  a: [[2,  1], [ 1, 1]],
  b: [[2, -1], [-1, 1]],
};

/**
 * Sanity-check that `rep` describes the once-punctured torus group: a
 * discrete faithful F₂ → SL(2,R) rep whose peripheral commutator [a, b]
 * is parabolic (cusp at the puncture) and whose generator axes intersect
 * properly inside H² (the "two intersecting translation axes" picture).
 *
 * Returns `{ ok, reasons }`. If `ok` is false, `reasons` lists every
 * failing condition with the offending numerical value.
 */
export function verifyPuncturedTorusRep(
  rep: HyperbolicRep, tol = 1e-9,
): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const detA = det2(rep.a);
  const detB = det2(rep.b);
  if (Math.abs(detA - 1) > tol) reasons.push(`det(A) = ${detA}, expected 1`);
  if (Math.abs(detB - 1) > tol) reasons.push(`det(B) = ${detB}, expected 1`);
  const trA = trace2(rep.a);
  const trB = trace2(rep.b);
  if (Math.abs(trA) <= 2 + tol) reasons.push(`|tr(A)| = ${Math.abs(trA)} ≤ 2 (A not hyperbolic; no translation axis)`);
  if (Math.abs(trB) <= 2 + tol) reasons.push(`|tr(B)| = ${Math.abs(trB)} ≤ 2 (B not hyperbolic; no translation axis)`);
  const comm = mul2(mul2(mul2(rep.a, rep.b), inv2(rep.a)), inv2(rep.b));
  const trComm = trace2(comm);
  if (Math.abs(trComm - (-2)) > tol) {
    reasons.push(`tr([A, B]) = ${trComm}, expected -2 (puncture should give parabolic commutator)`);
  }
  // Axis-intersection: fixed points on ∂H² (the real line) are roots of
  // m21 x² + (m22 - m11) x - m12 = 0. The two geodesic axes intersect in H²
  // iff their boundary endpoint pairs interleave on the real line.
  const fA = realFixedPoints(rep.a);
  const fB = realFixedPoints(rep.b);
  if (fA === null || fB === null) {
    reasons.push(`could not compute real fixed points (matrices may not be hyperbolic over R)`);
  } else if (!intervalsInterleave(fA, fB)) {
    reasons.push(`axes do NOT intersect in H² (A's fixed points ${fmtPair(fA)} and B's ${fmtPair(fB)} do not interleave on ∂H²)`);
  }
  return { ok: reasons.length === 0, reasons };
}

/**
 * Möbius fixed points of M on the real line: roots of
 *   m21 x² + (m22 − m11) x − m12 = 0.
 * Returns the two real roots, or null if either there's no x²-term (one
 * fixed point at ∞ — caller may treat separately) or no real roots.
 */
function realFixedPoints(M: Mat2R): readonly [number, number] | null {
  const a = M[1][0];
  const b = M[1][1] - M[0][0];
  const c = -M[0][1];
  if (a === 0) return null;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const sqrtD = Math.sqrt(disc);
  return [(-b + sqrtD) / (2 * a), (-b - sqrtD) / (2 * a)];
}

function intervalsInterleave(p: readonly [number, number], q: readonly [number, number]): boolean {
  const [a1, a2] = p[0] < p[1] ? [p[0], p[1]] : [p[1], p[0]];
  const [b1, b2] = q[0] < q[1] ? [q[0], q[1]] : [q[1], q[0]];
  return (a1 < b1 && b1 < a2 && a2 < b2) || (b1 < a1 && a1 < b2 && b2 < a2);
}

function fmtPair(p: readonly [number, number]): string {
  return `(${p[0].toFixed(4)}, ${p[1].toFixed(4)})`;
}

// Permanent assertion — runs whenever DEFAULT_REP is imported. Catches any
// future typo in the integer matrices that breaks the punctured-torus
// conditions before the demo's pipeline can produce garbage.
{
  const check = verifyPuncturedTorusRep(DEFAULT_REP);
  if (!check.ok) {
    const lines = check.reasons.map((r) => `  - ${r}`).join('\n');
    throw new Error(`[hypRep] DEFAULT_REP is not a valid punctured-torus rep:\n${lines}`);
  }
}
