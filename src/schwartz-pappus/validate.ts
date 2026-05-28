/**
 * Startup sanity checks for the Schwartz–Pappus rep. These are §7 of the
 * handoff spec, encoding the explicit trace and structural identities
 * stated in [S2 §4–§5] for the index-2 Z/3 ∗ Z/3 ⊂ Z/2 ∗ Z/3.
 *
 * Runs once at module load (called from main.ts). Logs a single ✓ line
 * per (c, d) test point or a noisy failure with details. The checks are
 * cheap — a few matrix products — so we run them at a handful of generic
 * test points to catch transcription errors in matrices.ts.
 */

import { mat3Det } from '../sl3r/action.ts';
import {
  pappusGenerators, morphing, anosovGenerators, mat3Mul, mat3Inv, mat3Trace,
  type Mat3R,
} from './matrices.ts';
import { dualityPsi, solveDualityA } from './duality.ts';

const ABS_TOL = 1e-9;
const REL_TOL = 1e-9;

function approxEq(actual: number, expected: number, tol = ABS_TOL): boolean {
  const scale = Math.max(1, Math.abs(expected));
  return Math.abs(actual - expected) < Math.max(tol, REL_TOL * scale);
}

function isScalarTimesI(M: Mat3R, label: string, errors: string[]): void {
  // Off-diagonal entries should be ~0; diagonal entries should be equal.
  const d0 = M[0][0], d1 = M[1][1], d2 = M[2][2];
  let maxOff = 0;
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    if (r === c) continue;
    const v = Math.abs(M[r][c]);
    if (v > maxOff) maxOff = v;
  }
  const diagScale = Math.max(Math.abs(d0), Math.abs(d1), Math.abs(d2), 1);
  if (maxOff > 1e-9 * diagScale) {
    errors.push(`${label}: max off-diagonal = ${maxOff.toExponential(2)} (expected ≈ 0)`);
  }
  if (!approxEq(d0, d1) || !approxEq(d1, d2)) {
    errors.push(`${label}: diagonal entries (${d0}, ${d1}, ${d2}) are not equal`);
  }
}

/**
 * Verify the explicit identities at one (c, d) test point. Returns the
 * list of failures (empty = pass).
 *
 * Checks from spec §7:
 *   1. r₁³, r₂³ are scalar multiples of I (order-3 generators).
 *   2. det(r₁r₂) = 1, tr(r₁r₂) = -1 (parabolic at Pappus).
 *   3. Trace identities Eq. 13–14 from [S2]:
 *        τ(r₁r₂²)   = 64 / [(1-c²)(1-d²)²]   where τ(M) = tr³(M)/det(M)
 *        τ(r₁²r₂)   = 64 / [(1-c²)²(1-d²)]
 *        tr[r₂,r₁] - tr[r₁,r₂] = 16cd / [(1-c²)(1-d²)]
 *           with [A, B] := A B A² B² (Schwartz's commutator convention).
 *   4. Morphing sanity: Σ(1,1) = I,  det Σ(a,b) = 1.
 *   5. Duality polynomial: ψ(1,1,c,d) = 0;  ψ(1/a,b,d,c) = -ψ(a,b,c,d).
 */
function checkAtPoint(c: number, d: number): string[] {
  const errors: string[] = [];
  const { r1, r2 } = pappusGenerators(c, d);

  // ── 1. r₁³, r₂³ scalar × I ─────────────────────────────────────────────
  const r1cubed = mat3Mul(mat3Mul(r1, r1), r1);
  const r2cubed = mat3Mul(mat3Mul(r2, r2), r2);
  isScalarTimesI(r1cubed, `r₁³ at (c,d)=(${c},${d})`, errors);
  isScalarTimesI(r2cubed, `r₂³ at (c,d)=(${c},${d})`, errors);

  // ── 2. det(r₁r₂) = 1, tr(r₁r₂) = -1 ────────────────────────────────────
  const r1r2 = mat3Mul(r1, r2);
  const dr1r2 = mat3Det(r1r2);
  if (!approxEq(dr1r2, 1, 1e-9)) {
    errors.push(`det(r₁r₂) = ${dr1r2} (expected 1) at (c,d)=(${c},${d})`);
  }
  const tr1r2 = mat3Trace(r1r2);
  if (!approxEq(tr1r2, -1, 1e-9)) {
    errors.push(`tr(r₁r₂) = ${tr1r2} (expected -1) at (c,d)=(${c},${d})`);
  }

  // ── 3a. τ(r₁r₂²) = 64 / [(1-c²)(1-d²)²] ────────────────────────────────
  const r2sq = mat3Mul(r2, r2);
  const r1r2sq = mat3Mul(r1, r2sq);
  const tauA = Math.pow(mat3Trace(r1r2sq), 3) / mat3Det(r1r2sq);
  const expA = 64 / ((1 - c * c) * (1 - d * d) * (1 - d * d));
  if (!approxEq(tauA, expA, 1e-6 * Math.abs(expA))) {
    errors.push(`τ(r₁r₂²) = ${tauA}, expected ${expA} at (c,d)=(${c},${d})`);
  }

  // ── 3b. τ(r₁²r₂) = 64 / [(1-c²)²(1-d²)] ────────────────────────────────
  const r1sq = mat3Mul(r1, r1);
  const r1sqr2 = mat3Mul(r1sq, r2);
  const tauB = Math.pow(mat3Trace(r1sqr2), 3) / mat3Det(r1sqr2);
  const expB = 64 / ((1 - c * c) * (1 - c * c) * (1 - d * d));
  if (!approxEq(tauB, expB, 1e-6 * Math.abs(expB))) {
    errors.push(`τ(r₁²r₂) = ${tauB}, expected ${expB} at (c,d)=(${c},${d})`);
  }

  // ── 3c. tr[r₂,r₁] - tr[r₁,r₂] = 16cd / [(1-c²)(1-d²)]
  //        with Schwartz's commutator [A, B] := A·B·A²·B² ────────────────
  const commR2R1 = mat3Mul(mat3Mul(mat3Mul(r2, r1), mat3Mul(r2, r2)), mat3Mul(r1, r1));
  const commR1R2 = mat3Mul(mat3Mul(mat3Mul(r1, r2), mat3Mul(r1, r1)), mat3Mul(r2, r2));
  const diff = mat3Trace(commR2R1) - mat3Trace(commR1R2);
  const expDiff = 16 * c * d / ((1 - c * c) * (1 - d * d));
  if (!approxEq(diff, expDiff, 1e-6 * Math.max(1, Math.abs(expDiff)))) {
    errors.push(
      `tr[r₂,r₁] - tr[r₁,r₂] = ${diff}, expected ${expDiff} at (c,d)=(${c},${d})`,
    );
  }

  // ── 5. Duality polynomial at Pappus and symmetries ─────────────────────
  const psiPappus = dualityPsi(1, 1, c, d);
  if (!approxEq(psiPappus, 0, 1e-12)) {
    errors.push(`ψ(1,1,${c},${d}) = ${psiPappus} (expected 0)`);
  }
  // Inverse Symmetry. Paper Eq. 24 commits only to the SIGN identity
  //   sign ψ(1/a, b, d, c) = -sign ψ(a, b, c, d).
  // Factoring out 1/a² from each of the two cubic-in-a inner polynomials
  // in ψ gives the stronger algebraic identity
  //   ψ(1/a, b, d, c) = -ψ(a, b, c, d) / a⁴
  // (numerically verified to ~1e-15 across a grid; this is a true
  // polynomial identity, not just an asymptotic). The stronger check is
  // a tighter test of the matrix transcription, so we use it here.
  const aTest = 1.7, bTest = 1.4;
  const psiLeft  = dualityPsi(1 / aTest, bTest, d, c);
  const psiRight = -dualityPsi(aTest, bTest, c, d) / Math.pow(aTest, 4);
  if (!approxEq(psiLeft, psiRight, 1e-9 * Math.max(1, Math.abs(psiRight)))) {
    errors.push(
      `ψ inverse symmetry violated: ψ(1/a,b,d,c) = ${psiLeft}, ` +
      `-ψ(a,b,c,d)/a⁴ = ${psiRight}`,
    );
  }
  // θ₄ symmetry (paper §5.3 "Symmetries: First, ψ ∘ θ₄ = ψ").
  // θ₄ is the order-4 rotation (c, d) ↦ (-d, c). Check ψ(a,b,-d,c) = ψ(a,b,c,d).
  for (const [aT, bT] of [[1.7, 1.4], [0.6, 2.0], [1.0, 1.0]] as const) {
    const psiOrig = dualityPsi(aT, bT, c, d);
    const psiRot  = dualityPsi(aT, bT, -d, c);
    if (!approxEq(psiOrig, psiRot, 1e-9 * Math.max(1, Math.abs(psiOrig)))) {
      errors.push(
        `ψ θ₄ symmetry violated at (a,b)=(${aT},${bT}): ` +
        `ψ(a,b,c,d) = ${psiOrig}, ψ(a,b,-d,c) = ${psiRot}`,
      );
    }
  }

  return errors;
}

function checkMorphing(): string[] {
  const errors: string[] = [];
  const I = morphing(1, 1);
  for (let r = 0; r < 3; r++) for (let cc = 0; cc < 3; cc++) {
    const expected = r === cc ? 1 : 0;
    if (!approxEq(I[r][cc], expected, 1e-12)) {
      errors.push(`Σ(1,1)[${r}][${cc}] = ${I[r][cc]} (expected ${expected})`);
    }
  }
  for (const [a, b] of [[1.3, 1.6], [0.7, 2.0], [2.4, 1.1]] as const) {
    const det = mat3Det(morphing(a, b));
    if (!approxEq(det, 1, 1e-12)) {
      errors.push(`det Σ(${a}, ${b}) = ${det} (expected 1)`);
    }
  }
  return errors;
}

/**
 * Sweep (c, d, b) and confirm that solveDualityA picks the Anosov branch
 * (paper §5.3: the Anosov arc of ψ=0 has tr(g₁·g₂) < -1; the elliptic arc
 * has tr ∈ (0, 1)). This is the post-hoc check that the Brent bracket in
 * duality.ts isolates the correct root.
 *
 * At b = 1 (Pappus boundary), g₂ = r₂ and tr(r₁·r₂) = -1 exactly (parabolic
 * boundary case); we allow trace ≤ -1 with a small tolerance for floating
 * point.
 */
function checkAnosovBranch(): string[] {
  const errors: string[] = [];
  const cs = [-0.6, -0.2, 0.2, 0.4, 0.6];
  const ds = [-0.6, -0.2, 0.2, 0.4, 0.6];
  // Include small b values where S_b is a strict subset of [1/2, 2]
  // (potential bracket trap if not handled correctly).
  const bs = [1.0, 1.05, 1.1, 1.3, 1.5, 2.0, 2.5, 2.9];
  let count = 0;
  for (const c of cs) for (const d of ds) {
    if (c === 0 && d === 0) continue;
    for (const b of bs) {
      const a = solveDualityA(b, c, d);
      const { g1, g2 } = anosovGenerators(c, d, a, b);
      const tr = mat3Trace(mat3Mul(g1, g2));
      // Anosov branch: tr < -1; allow b = 1 boundary case at tr ≈ -1.
      if (tr > -1 + 1e-6) {
        errors.push(
          `Anosov-branch test failed at (c,d,b)=(${c},${d},${b}): ` +
          `a=${a.toFixed(6)}, tr(g₁·g₂) = ${tr.toFixed(6)} (expected < -1)`,
        );
      }
      count++;
    }
  }
  if (errors.length === 0) {
    console.log(`[schwartz-pappus] Anosov-branch sweep: passed (${count} (c,d,b) points)`);
  }
  return errors;
}

/**
 * Run all §7 checks at a few generic test points. Throws on any failure
 * so a broken matrices.ts is caught at startup. Returns silently otherwise
 * after logging summary lines.
 */
export function validatePappus(): void {
  const allErrors: string[] = [];
  allErrors.push(...checkMorphing());
  for (const [c, d] of [
    [0.2, 0.4],
    [0.1, 0.1],
    [-0.3, 0.5],
    [0.5, -0.2],
    [-0.4, -0.6],
    [0.7, 0.3],
  ] as const) {
    allErrors.push(...checkAtPoint(c, d));
  }
  allErrors.push(...checkAnosovBranch());
  if (allErrors.length > 0) {
    console.error('[schwartz-pappus] validation failed:');
    for (const e of allErrors) console.error(`  ${e}`);
    throw new Error(`Schwartz-Pappus validation failed (${allErrors.length} errors)`);
  }
  console.log('[schwartz-pappus] §7 validation: passed (morphing + 6 (c,d) points + θ₄ symmetry)');
}
