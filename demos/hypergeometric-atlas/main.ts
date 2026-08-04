/**
 * Hypergeometric atlas — browse EVERY hypergeometric monodromy group of degree
 * ≤ 6: the full (α, β) classification lists, one table per (degree,
 * invariant-form type), from O(1) up to Sp(6,ℝ).
 *
 * Data: `@/examples/hypergeometric/degree-le6` (generated from the raw pair
 * lists; every row's form parity + signature verified exactly on emission).
 * The viewer itself is `@/app/hypergeometricAtlas`, shared with the degree 7
 * atlas (`demos/hypergeometric-deg7`).
 *
 * Offline renders: scripts/render/hypergeometric-atlas.ts.
 */

import { mountHypergeometricAtlas } from '@/app/hypergeometricAtlas';
import { CATALOG } from '@/examples/hypergeometric/degree-le6';

mountHypergeometricAtlas({
  catalog: CATALOG,
  /** Stable identifier — saved presets key off it. Do not change. */
  groupTag: 'hypergeometric-atlas',
  shotPrefix: 'hg-atlas',
  title: 'hypergeometric atlas (degree ≤ 6)',
  blurb:
    'Every hypergeometric monodromy group ⟨A, B⟩ of degree ≤ 6, by degree and ' +
    'invariant form — A, B the companion matrices of ∏(x − e<sup>2πiαⱼ</sup>), ' +
    '∏(x − e<sup>2πiβⱼ</sup>).',
  defaultTable: 'd5-o32',
});
