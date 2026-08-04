/**
 * Offline density render of a degree 7 hypergeometric limit set — a thin plugin
 * over the shared scripts/render/renderDriver.ts. See that file for flags and
 * the two render modes (view-preset vs auto). ids are '<table>-<n>', e.g.:
 *   node scripts/render/hypergeometric-deg7.ts d7-o43-1 16 --gamma 0.5
 *   node scripts/render/hypergeometric-deg7.ts d7-o52-7 14
 */
import { renderHypergeometricAtlas } from './hypergeometricAtlasRender.ts';
import { CATALOG } from '../../src/examples/hypergeometric/degree7.ts';

await renderHypergeometricAtlas({
  catalog: CATALOG,
  family: 'hypergeometric-deg7',
  defaultExampleId: 'd7-o43-1',
  defaultDepth: 14,
});
