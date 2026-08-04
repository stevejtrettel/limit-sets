/**
 * The invariant bilinear form of an integer matrix group — decided EXACTLY.
 *
 * For generators g₁…gₖ ∈ GL(n,ℤ), the invariant forms are the solutions G of
 *   gᵢᵀ G gᵢ = G   for every i,
 * a linear condition on G that respects the symmetric/antisymmetric splitting
 * (gᵀGg is symmetric iff G is). So we solve in each parity subspace separately:
 * which side is nonzero tells you the emergent geometry — a symmetric G means
 * the group sits in an orthogonal group O(p,q) (signature by Sylvester, exact),
 * an alternating G means a symplectic group Sp(n). Everything here is bigint /
 * rational, so "preserves a form of signature (3,2)" is a decision, not a
 * float comparison.
 *
 * Pure ability — no example data.
 */

import {
  type IMat, ikernel, imul, itranspose, irank,
  signatureOfSymmetricInt, type Signature,
} from './exactMatrix.ts';

/** Basis matrices of each parity subspace of n×n matrices:
 *  symmetric  — eᵢᵢ and eᵢⱼ+eⱼᵢ (i<j);  antisymmetric — eᵢⱼ−eⱼᵢ (i<j). */
function parityBasis(n: number, parity: 'symmetric' | 'antisymmetric'): IMat[] {
  const basis: IMat[] = [];
  const zero = (): IMat => Array.from({ length: n }, () => Array<bigint>(n).fill(0n));
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      if (parity === 'antisymmetric' && i === j) continue;
      const E = zero();
      if (i === j) E[i][i] = 1n;
      else { E[i][j] = 1n; E[j][i] = parity === 'symmetric' ? 1n : -1n; }
      basis.push(E);
    }
  }
  return basis;
}

/** All invariant forms of the given parity, as primitive integer matrices.
 *  (Solves gᵀGg − G = 0 for all generators on the parity subspace.) */
export function invariantForms(
  gens: readonly IMat[], parity: 'symmetric' | 'antisymmetric',
): IMat[] {
  if (gens.length === 0) throw new Error('invariantForms: no generators');
  const n = gens[0].length;
  const basis = parityBasis(n, parity);
  const dim = basis.length;
  if (dim === 0) return [];

  // Constraint matrix: rows = (generator, matrix entry), cols = basis coeffs.
  const gT = gens.map(itranspose);
  const M: bigint[][] = [];
  for (let gi = 0; gi < gens.length; gi++) {
    const images = basis.map((E) => imul(imul(gT[gi], E), gens[gi]));
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        M.push(basis.map((E, k) => images[k][r][c] - E[r][c]));
      }
    }
  }

  return ikernel(M).map((coeffs) => {
    const G: IMat = Array.from({ length: n }, () => Array<bigint>(n).fill(0n));
    for (let k = 0; k < dim; k++) {
      if (coeffs[k] === 0n) continue;
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) G[r][c] += coeffs[k] * basis[k][r][c];
      }
    }
    return G;
  });
}

/** What geometry a generator set carries, when it is unambiguous. */
export interface InvariantFormType {
  kind: 'orthogonal' | 'symplectic';
  /** The invariant form (primitive integer entries, unique up to sign). */
  form: IMat;
  /** Sylvester signature — orthogonal only. G is only defined up to sign, so
   *  (p, q) and (q, p) describe the same geometry. */
  signature?: Signature;
}

/**
 * The emergent form type of a generator set: expects EXACTLY ONE invariant form
 * overall (dim 1 in one parity, dim 0 in the other — the irreducible case) and
 * that form nondegenerate; throws otherwise, naming what it found. Symmetric ⇒
 * orthogonal with exact signature; alternating ⇒ symplectic.
 */
export function invariantFormType(gens: readonly IMat[]): InvariantFormType {
  const sym = invariantForms(gens, 'symmetric');
  const anti = invariantForms(gens, 'antisymmetric');
  if (sym.length + anti.length !== 1) {
    throw new Error(
      `invariantFormType: expected a unique invariant form, found ` +
      `dim ${sym.length} symmetric + dim ${anti.length} antisymmetric`,
    );
  }
  const n = gens[0].length;
  if (sym.length === 1) {
    const s = signatureOfSymmetricInt(sym[0]);
    if (s.zero > 0) throw new Error(`invariantFormType: symmetric form is degenerate (${s.zero} null directions)`);
    return { kind: 'orthogonal', form: sym[0], signature: s };
  }
  if (irank(anti[0]) !== n) throw new Error('invariantFormType: alternating form is degenerate');
  return { kind: 'symplectic', form: anti[0] };
}
