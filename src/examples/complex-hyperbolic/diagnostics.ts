/**
 * Research diagnostics for SU(2,1) configurations — pure functions, no UI.
 *
 * Three dials, each usable from a script or wired into a panel later:
 *
 *   classifyElement(M)      — loxodromic / parabolic / elliptic, via Goldman's
 *                             trace discriminant on the SU(2,1)-normalized
 *                             trace τ = tr(M)/det(M)^{1/3}. Generalizes the
 *                             ι₁ι₂ι₃ dial of recipe.ts to ANY element.
 *   classifyMirrorPair(c,c') — how two complex geodesics sit: crossing at an
 *                             interior point (angle), asymptotic (shared ideal
 *                             point), or ultraparallel (common perpendicular).
 *   cartanReport(points)    — every triple's Cartan invariant measured against
 *                             the Goldman–Parker threshold A*, plus (for 4
 *                             points) the exact cocycle identity
 *                             A₂₃₄ − A₁₃₄ + A₁₂₄ − A₁₂₃ = 0 as a sanity value.
 *
 * `wordProduct` folds generator matrices along a word so classifyElement can
 * be applied to any word the orbit walker would walk — this is the "is some
 * short word secretly elliptic?" research tool that face-filters can't see.
 */

import { type CMat, type Cx, cmat, cmatDim, cmatMul, cmatDet } from '../../core/complexMatrix.ts';
import { type CVec3, herm, cartanInvariant } from './hermitian.ts';
import { GP_CRITICAL_A, goldmanDiscriminant } from './recipe.ts';

// ─── Element classification ─────────────────────────────────────────────────

export type ElementType = 'loxodromic' | 'parabolic' | 'elliptic';

export interface ElementClass {
  type: ElementType;
  /** Goldman discriminant f(τ): > 0 loxodromic, < 0 regular elliptic, ≈ 0 the
   *  parabolic (or boundary-elliptic) wall. */
  f: number;
  /** SU(2,1)-normalized trace τ = tr(M)/det(M)^{1/3} (any cube root; f is
   *  invariant under the remaining ω³=1 ambiguity). */
  tau: Cx;
}

/**
 * Classify M ∈ U(2,1) (3×3) by Goldman's trace criterion. `parabolicTol` is
 * the |f| band reported as 'parabolic' — the wall between loxodromic and
 * elliptic, which numerically is a band, not a point. Note f ≈ 0 also occurs
 * for boundary (non-regular) elliptics; distinguishing those needs eigenvalue
 * inspection, which this dial deliberately avoids.
 */
export function classifyElement(M: CMat, opts: { parabolicTol?: number } = {}): ElementClass {
  const n = cmatDim(M);
  if (n !== 3) throw new Error(`classifyElement: expected 3×3, got ${n}×${n}`);
  const tol = opts.parabolicTol ?? 1e-8;
  const d = cmatDet(M);
  // any cube root of det
  const r = Math.cbrt(Math.hypot(d[0], d[1]));
  const th = Math.atan2(d[1], d[0]) / 3;
  const cr = r * Math.cos(th), ci = r * Math.sin(th);
  let trR = 0, trI = 0;
  for (let k = 0; k < 3; k++) { trR += M[2 * (3 * k + k)]; trI += M[2 * (3 * k + k) + 1]; }
  const den = cr * cr + ci * ci;
  const tau: Cx = [(trR * cr + trI * ci) / den, (trI * cr - trR * ci) / den];
  const f = goldmanDiscriminant(tau);
  const type: ElementType = f > tol ? 'loxodromic' : f < -tol ? 'elliptic' : 'parabolic';
  return { type, f, tau };
}

/** The 3×3 complex matrix of a word (apply-order codes, matching the
 *  GroupAction convention: the group element is the REVERSE product). */
export function wordProduct(mats: readonly CMat[], word: readonly number[]): CMat {
  let M = cmat([[[1, 0], [0, 0], [0, 0]], [[0, 0], [1, 0], [0, 0]], [[0, 0], [0, 0], [1, 0]]]);
  for (const g of word) M = cmatMul(mats[g], M);
  return M;
}

/**
 * Smallest n ≤ maxOrder with Mⁿ a SCALAR matrix (projectively the identity),
 * or null if none. Separates BENIGN elliptics — finite order, compatible with
 * discreteness, e.g. the order-p vertex rotations of a (p,q,r) triangle
 * group — from fatal infinite-order elliptics (dense orbits ⟹ non-discrete).
 */
export function ellipticOrder(M: CMat, maxOrder = 200, tol = 1e-8): number | null {
  const n = cmatDim(M);
  let P = M;
  for (let k = 1; k <= maxOrder; k++) {
    if (k > 1) P = cmatMul(P, M);
    // Scalar test: P ≈ λI with λ = P₀₀.
    const lr = P[0], li = P[1];
    const scale = Math.max(1, Math.hypot(lr, li));
    let worst = 0;
    for (let r = 0; r < n && worst < tol * scale; r++) {
      for (let c = 0; c < n; c++) {
        const er = P[2 * (r * n + c)] - (r === c ? lr : 0);
        const ei = P[2 * (r * n + c) + 1] - (r === c ? li : 0);
        worst = Math.max(worst, Math.hypot(er, ei));
      }
    }
    if (worst < tol * scale) return k;
  }
  return null;
}

// ─── Complex 3×3 eigenvalues (Cardano) ──────────────────────────────────────

const cxMul = (a: Cx, b: Cx): Cx => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const cxSqrt = (a: Cx): Cx => {
  const r = Math.sqrt(Math.hypot(a[0], a[1])), t = Math.atan2(a[1], a[0]) / 2;
  return [r * Math.cos(t), r * Math.sin(t)];
};
const cxCbrt = (a: Cx): Cx => {
  const r = Math.cbrt(Math.hypot(a[0], a[1])), t = Math.atan2(a[1], a[0]) / 3;
  return [r * Math.cos(t), r * Math.sin(t)];
};

/** Eigenvalues of a complex 3×3 matrix, by Cardano on the characteristic
 *  cubic (coefficients from tr M, tr M², det M). Adequate precision for the
 *  unit-modulus spectra used here (~1e-12). */
export function cmat3Eigenvalues(M: CMat): [Cx, Cx, Cx] {
  if (cmatDim(M) !== 3) throw new Error('cmat3Eigenvalues: expected 3×3');
  let trR = 0, trI = 0;
  for (let k = 0; k < 3; k++) { trR += M[2 * (3 * k + k)]; trI += M[2 * (3 * k + k) + 1]; }
  const M2 = cmatMul(M, M);
  let t2R = 0, t2I = 0;
  for (let k = 0; k < 3; k++) { t2R += M2[2 * (3 * k + k)]; t2I += M2[2 * (3 * k + k) + 1]; }
  const det = cmatDet(M);
  // λ³ + aλ² + bλ + c with a = −tr, b = (tr² − tr M²)/2, c = −det.
  const a: Cx = [-trR, -trI];
  const b: Cx = [(trR * trR - trI * trI - t2R) / 2, (2 * trR * trI - t2I) / 2];
  const c: Cx = [-det[0], -det[1]];
  // Depressed cubic t³ + pt + q, λ = t − a/3.
  const a2 = cxMul(a, a);
  const p: Cx = [b[0] - a2[0] / 3, b[1] - a2[1] / 3];
  const a3 = cxMul(a2, a);
  const q: Cx = [
    (2 / 27) * a3[0] - (a[0] * b[0] - a[1] * b[1]) / 3 + c[0],
    (2 / 27) * a3[1] - (a[0] * b[1] + a[1] * b[0]) / 3 + c[1],
  ];
  const D: Cx = [
    (q[0] * q[0] - q[1] * q[1]) / 4 + (p[0] * (p[0] * p[0] - 3 * p[1] * p[1])) / 27,
    (q[0] * q[1]) / 2 + (p[1] * (3 * p[0] * p[0] - p[1] * p[1])) / 27,
  ];
  const sq = cxSqrt(D);
  let u = cxCbrt([-q[0] / 2 + sq[0], -q[1] / 2 + sq[1]]);
  if (Math.hypot(u[0], u[1]) < 1e-30) u = cxCbrt([-q[0] / 2 - sq[0], -q[1] / 2 - sq[1]]);
  const uAbs2 = u[0] * u[0] + u[1] * u[1];
  const v: Cx = uAbs2 < 1e-60
    ? [0, 0]
    : [(-p[0] / 3 * u[0] - p[1] / 3 * u[1]) / uAbs2, (-p[1] / 3 * u[0] + p[0] / 3 * u[1]) / uAbs2];
  const W: Cx = [-0.5, Math.sqrt(3) / 2];   // ω = e^{2πi/3}
  const Wb: Cx = [-0.5, -Math.sqrt(3) / 2];
  const roots: Cx[] = [];
  let wu: Cx = u, wv: Cx = v;
  for (let k = 0; k < 3; k++) {
    roots.push([wu[0] + wv[0] - a[0] / 3, wu[1] + wv[1] - a[1] / 3]);
    wu = cxMul(wu, W); wv = cxMul(wv, Wb);
  }
  return roots as [Cx, Cx, Cx];
}

/** Unit-circle eigenvalue angles of the SU(2,1)-normalized M (meaningful for
 *  elliptic/parabolic elements, where all |λ| = 1). */
export function ellipticAngles(M: CMat): [number, number, number] {
  const d = cmatDet(M);
  const th = Math.atan2(d[1], d[0]) / 3;   // arg det^{1/3}; moduli are moot for angles
  const roots = cmat3Eigenvalues(M);
  return roots
    .map(([x, y]) => Math.atan2(y, x) - th)
    .map((t) => Math.atan2(Math.sin(t), Math.cos(t))) as [number, number, number];
}

/** Smallest pairwise angular gap between the eigenvalues on the unit circle:
 *  exactly 0 at a parabolic (two eigenvalues coalesce); for the emerging
 *  elliptic, the SPLITTING ANGLE. The order-n locus of a 1-parameter family
 *  is where this equals 2π/n (verify with `ellipticOrder` afterwards). */
export function splittingAngle(M: CMat): number {
  const [x, y, z] = ellipticAngles(M);
  const gap = (s: number, t: number): number => {
    const d = Math.abs(s - t) % (2 * Math.PI);
    return Math.min(d, 2 * Math.PI - d);
  };
  return Math.min(gap(x, y), gap(y, z), gap(z, x));
}

// ─── Elliptic word scan ─────────────────────────────────────────────────────

/** Cyclically-reduced non-backtracking words over an INVOLUTION alphabet
 *  (no letter repeated consecutively, first ≠ last), one representative per
 *  cyclic-rotation class, lengths 2..maxLen. Length-1 words are the
 *  generators themselves — reflections, elliptic by design — and are skipped. */
export function* cyclicWordClasses(numGen: number, maxLen: number): Generator<number[]> {
  const seen = new Set<string>();
  const stack: number[] = [];
  function* rec(len: number): Generator<number[]> {
    if (stack.length === len) {
      if (stack[0] === stack[len - 1]) return;      // not cyclically reduced
      let best = '';
      for (let r = 0; r < len; r++) {
        const rot = [...stack.slice(r), ...stack.slice(0, r)].join(',');
        if (best === '' || rot < best) best = rot;
      }
      if (!seen.has(best)) { seen.add(best); yield stack.slice(); }
      return;
    }
    const last = stack.length > 0 ? stack[stack.length - 1] : -1;
    for (let g = 0; g < numGen; g++) {
      if (g === last) continue;
      stack.push(g);
      yield* rec(len);
      stack.pop();
    }
  }
  for (let len = 2; len <= maxLen; len++) yield* rec(len);
}

export interface EllipticScan {
  scanned: number;
  loxodromic: number;
  parabolic: number;
  /** The alarm: elliptic word classes (apply-order codes) with their f and
   *  projective order (null = no order ≤ maxOrder found). FINITE order is
   *  benign (a torsion element, fine in a discrete group — e.g. the designed
   *  vertex rotations of a (p,q,r) triangle group); null order means
   *  non-discreteness. */
  elliptic: { word: number[]; f: number; order: number | null }[];
}

/** Classify every cyclic word class up to `maxLen` over an involution
 *  alphabet given by its reflection matrices. The face filter can't see
 *  these — this is where mixed words (e.g. opposite-edge products) betray a
 *  configuration. `maxOrder` bounds the finite-order search per elliptic. */
export function scanEllipticWords(
  mats: readonly CMat[], maxLen: number, opts: { maxOrder?: number } = {},
): EllipticScan {
  const out: EllipticScan = { scanned: 0, loxodromic: 0, parabolic: 0, elliptic: [] };
  for (const w of cyclicWordClasses(mats.length, maxLen)) {
    const M = wordProduct(mats, w);
    const cls = classifyElement(M);
    out.scanned++;
    if (cls.type === 'loxodromic') out.loxodromic++;
    else if (cls.type === 'parabolic') out.parabolic++;
    else out.elliptic.push({ word: w, f: cls.f, order: ellipticOrder(M, opts.maxOrder ?? 200) });
  }
  return out;
}

// ─── Mirror-pair classification ─────────────────────────────────────────────

export type MirrorPairType = 'crossing' | 'asymptotic' | 'ultraparallel';

export interface MirrorPairClass {
  type: MirrorPairType;
  /** η = |⟨c₁,c₂⟩|² / (⟨c₁,c₁⟩⟨c₂,c₂⟩): < 1 crossing, = 1 asymptotic,
   *  > 1 ultraparallel. */
  eta: number;
  /** crossing only: the intersection angle φ ∈ (0, π/2], cos φ = √η. */
  angle?: number;
  /** ultraparallel only: the distance ℓ between the geodesics,
   *  cosh(ℓ/2) = √η. */
  distance?: number;
}

/** How the complex geodesics polar to c₁, c₂ (both positive vectors) sit
 *  relative to each other. `asymptoticTol` is the |η − 1| band reported as
 *  asymptotic. */
export function classifyMirrorPair(
  c1: CVec3, c2: CVec3, opts: { asymptoticTol?: number } = {},
): MirrorPairClass {
  const tol = opts.asymptoticTol ?? 1e-10;
  const [n1] = herm(c1, c1);
  const [n2] = herm(c2, c2);
  if (n1 <= 0 || n2 <= 0) throw new Error('classifyMirrorPair: both vectors must be positive');
  const h = herm(c1, c2);
  const eta = (h[0] * h[0] + h[1] * h[1]) / (n1 * n2);
  if (Math.abs(eta - 1) < tol) return { type: 'asymptotic', eta };
  if (eta < 1) return { type: 'crossing', eta, angle: Math.acos(Math.sqrt(eta)) };
  return { type: 'ultraparallel', eta, distance: 2 * Math.acosh(Math.sqrt(eta)) };
}

// ─── Cartan report over point configurations ────────────────────────────────

export interface TripleInvariant {
  /** Point indices, ascending. */
  triple: [number, number, number];
  /** Cartan angular invariant of the triple. */
  A: number;
  /** |A| / A* — 1 is the Goldman–Parker discreteness wall. */
  ratioToCritical: number;
  /** |A| ≤ A*: the triple's ideal triangle group is a discrete embedding
   *  (Schwartz). */
  withinGP: boolean;
}

export interface CartanReport {
  triples: TripleInvariant[];
  /** For exactly 4 points: A₂₃₄ − A₁₃₄ + A₁₂₄ − A₁₂₃. Exactly 0 in theory
   *  (the Cartan invariant is a 2-cocycle); a nonzero value beyond Float64
   *  noise means the input points are bad. Null unless 4 points. */
  cocycleSum: number | null;
}

/** Cartan invariant of every point-triple, measured against A*. */
export function cartanReport(points: readonly CVec3[]): CartanReport {
  const n = points.length;
  const triples: TripleInvariant[] = [];
  const byKey = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      for (let k = j + 1; k < n; k++) {
        const A = cartanInvariant(points[i], points[j], points[k]);
        byKey.set(`${i},${j},${k}`, A);
        triples.push({
          triple: [i, j, k],
          A,
          ratioToCritical: Math.abs(A) / GP_CRITICAL_A,
          withinGP: Math.abs(A) <= GP_CRITICAL_A + 1e-12,
        });
      }
    }
  }
  let cocycleSum: number | null = null;
  if (n === 4) {
    cocycleSum =
      byKey.get('1,2,3')! - byKey.get('0,2,3')! + byKey.get('0,1,3')! - byKey.get('0,1,2')!;
  }
  return { triples, cocycleSum };
}
