/**
 * Offline density render of a degree ≤ 6 hypergeometric limit set — a thin
 * plugin over the shared scripts/render/renderDriver.ts. See that file for
 * flags and the two render modes (view-preset vs auto). ids are
 * '<table>-<n>', e.g.:
 *   node scripts/render/hypergeometric-atlas.ts d5-o32-1 16 --gamma 0.5
 *   node scripts/render/hypergeometric-atlas.ts d6-sp-7 11
 */
import { renderHypergeometricAtlas } from './hypergeometricAtlasRender.ts';
import { CATALOG } from '../../src/examples/hypergeometric/degree-le6.ts';

await renderHypergeometricAtlas({
  catalog: CATALOG,
  family: 'hypergeometric-atlas',
  defaultExampleId: 'd5-o32-1',
  defaultDepth: 14,
});
