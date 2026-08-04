/**
 * Degree 7 hypergeometric atlas — the same viewer as `demos/hypergeometric-atlas`
 * pointed at the degree 7 classification lists: 509 groups in four tables,
 * O(4,3) · O(5,2) · O(6,1) · O(7). Degree 7 is odd, so there is no symplectic
 * table and every table free-products on {T, B} with T = B·A⁻¹ an involution;
 * the limit sets live in RP⁶.
 *
 * Data: `@/examples/hypergeometric/degree7` (generated from the raw pair lists;
 * every row's form parity + signature verified exactly on emission). Viewer:
 * `@/app/hypergeometricAtlas`.
 *
 * Offline renders: scripts/render/hypergeometric-deg7.ts.
 */

import { mountHypergeometricAtlas } from '@/app/hypergeometricAtlas';
import { CATALOG } from '@/examples/hypergeometric/degree7';

mountHypergeometricAtlas({
  catalog: CATALOG,
  /** Stable identifier — saved presets key off it. Do not change. */
  groupTag: 'hypergeometric-deg7',
  shotPrefix: 'hg-deg7',
  title: 'hypergeometric atlas (degree 7)',
  blurb:
    'Every hypergeometric monodromy group ⟨A, B⟩ of degree 7, by invariant form ' +
    '— A, B the companion matrices of ∏(x − e<sup>2πiαⱼ</sup>), ' +
    '∏(x − e<sup>2πiβⱼ</sup>), acting on RP<sup>6</sup>.',
  defaultTable: 'd7-o43',
});
