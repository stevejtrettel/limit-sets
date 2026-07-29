/**
 * What the info window shows: the actual matrices this example is built from,
 * the basepoint the limit set was grown from, and how that basepoint was found.
 *
 * The seeding story is the part that is genuinely non-obvious from the picture,
 * so it gets the most room — see `recipe.ts` for the same argument in code and
 * `scripts/tests/galois-sl3-gates.ts` for it as an assertion.
 *
 * Presentation only: no mathematics is computed here that isn't already in
 * family.ts / recipe.ts.
 */

import { matrixHtml, stackedVectorsHtml, vectorHtml, type InfoSection } from '../../app/InfoPanel.ts';
import { matBlockDiag, matDet, matDim, matMul, matTrace, type Mat } from '../../core/matrix.ts';
import { charPoly, complexAbs, polyRoots } from '../../core/linalg.ts';
import type { BlockSeed, Seed } from '../../core/seed.ts';
import type { GaloisExample } from './catalog.ts';
import { generatorsAt } from './family.ts';
import type { SeedMode } from './recipe.ts';

const isBlockSeed = (s: Seed): s is BlockSeed => 'blockLambdaMax' in s;

const num = (x: number, d = 6): string => (Object.is(x, -0) ? 0 : x).toFixed(d);

const rowsOf = (M: Mat): number[][] => {
  const n = matDim(M);
  return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => M[i * n + j]));
};

/** Eigenvalues by descending modulus, formatted; real ones printed as reals. */
function spectrumText(M: Mat): string {
  return polyRoots(charPoly(rowsOf(M)))
    .sort((a, b) => complexAbs(b) - complexAbs(a))
    .map((z) => (Math.abs(z.im) < 1e-9
      ? num(z.re)
      : `${num(z.re, 4)} ${z.im >= 0 ? '+' : '−'} ${num(Math.abs(z.im), 4)}i`))
    .join(',  ');
}

/** "det … tr … spec { … }" — measured off the matrix, not asserted from t. */
const invariantsHtml = (M: Mat): string =>
  `<p class="dim">det ${num(matDet(M))} &nbsp; tr ${num(matTrace(M))}<br>` +
  `spec { ${spectrumText(M)} }</p>`;

export function describeExample(
  ex: GaloisExample,
  seedMode: SeedMode,
  seed: Seed,
): InfoSection[] {
  const u = ex.unit;
  const [A, B] = generatorsAt(u.t);
  const [As, Bs] = generatorsAt(u.tSigma);
  const sign = u.norm > 0 ? '+1' : '−1';

  const group: InfoSection = {
    heading: 'the group  ⟨A, B⟩ ⊂ SL(3, 𝒪_K)',
    html:
      `<p>K = ℚ(√${u.d}),  t = ${u.label} ≈ ${num(u.t)},  t<sup>σ</sup> ≈ ${num(u.tSigma)}.<br>` +
      `t + t<sup>σ</sup> = ${u.trace},  t·t<sup>σ</sup> = ${sign}.</p>` +
      `<div class="matlabel">A(t)</div>${matrixHtml(A)}${invariantsHtml(A)}` +
      `<div class="matlabel">B(t)</div>${matrixHtml(B)}${invariantsHtml(B)}` +
      `<div class="matlabel">A(t)·B(t)</div>${invariantsHtml(matMul(A, B))}`,
  };

  const embedding: InfoSection = {
    heading: 'the Galois embedding into SL(6,ℝ)',
    html:
      `<p>Compute the discrete embedding γ ↦ (γ, γ<sup>σ</sup>) ∈ SL(3,ℝ)×SL(3,ℝ), ` +
      `written as the block sum diag(γ, γ<sup>σ</sup>) acting on RP⁵.</p>` +
      `<div class="matlabel">diag(A, A<sup>σ</sup>)</div>` +
      matrixHtml(matBlockDiag([A, As]), { digits: 3, blockSplit: 3 }) +
      `<div class="matlabel">diag(B, B<sup>σ</sup>)</div>` +
      matrixHtml(matBlockDiag([B, Bs]), { digits: 3, blockSplit: 3 }),
  };

  return [group, embedding, basepointSection(seedMode, seed)];
}

function basepointSection(seedMode: SeedMode, seed: Seed): InfoSection {
  const b = seed.basepoint;
  const top = b.slice(0, 3);
  const bot = b.slice(3, 6);

  const why =
    `<p>Both coordinate 3-planes ℝ³⊕0 and 0⊕ℝ³ are invariant, and a proximal 6×6 ` +
    `element fixes a point inside one of them — seeding there redraws a single ` +
    `SL(3,ℝ) picture in a plane.</p>`;

  if (seedMode !== 'join') {
    const which = seedMode === 'factor1' ? 'ρ (top 3×3)' : 'ρ<sup>σ</sup> (bottom 3×3)';
    return {
      heading: 'the basepoint — single factor (degenerate)',
      html:
        why +
        `<p>This mode deliberately does exactly that: it seeds at the proximal fixed ` +
        `point of ${which} alone, zero-padded into ℝ⁶. The orbit never leaves that ` +
        `plane — it is here as the control, to see what the joined seed avoids.</p>` +
        `<p class="dim">γ = ${seed.name},  |λ| ≈ ${num(seed.lambdaMax, 4)},  ` +
        `drift = ${seed.drift.toExponential(2)}</p>` +
        stackedVectorsHtml([
          { label: 'top   ', v: top },
          { label: 'bottom', v: bot },
        ]),
    };
  }

  const lam = isBlockSeed(seed)
    ? `<p class="dim">|λ| = [${seed.blockLambdaMax.map((l) => num(l, 4)).join(',  ')}] ` +
      `— one per block; smallest relative spectral gap ${num(seed.minGap, 4)}.</p>`
    : '';

  return {
    heading: 'the basepoint — joined (RP⁵)',
    html:
      why +
      `<p>Instead, search the word tree for one word γ loxodromic in <b>both</b> 3×3 ` +
      `blocks — an isolated real dominant eigenvalue in each — then:</p>` +
      `<p>&nbsp;&nbsp;1. power-iterate γ in the <b>top</b> block → ξ₊<br>` +
      `&nbsp;&nbsp;2. power-iterate the same γ in the <b>bottom</b> block → ξ₊<sup>σ</sup><br>` +
      `&nbsp;&nbsp;3. stack the two unit vectors.</p>` +
      `<p>The result lies on neither plane.</p>` +
      `<p>γ = <b>${seed.name}</b>,  drift = ${seed.drift.toExponential(2)}</p>` +
      lam +
      stackedVectorsHtml([
        { label: 'ξ₊      ', v: top },
        { label: 'ξ₊^σ    ', v: bot },
      ]) +
      `<p>Stacking them weights the two factors equally — a <b>choice</b>: each ` +
      `(a·ξ₊, b·ξ₊<sup>σ</sup>) with a, b ≠ 0 is a <i>different</i> point of RP⁵, running ` +
      `along the projective line joining the two block fixed points. We take a = b, so ` +
      `‖top‖ = ‖bottom‖ = 1/√2.</p>` +
      vectorHtml(b, 4),
  };
}
