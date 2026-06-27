import { CATALOG_EXAMPLES } from '../../src/examples/hypergeometric/degree5-orthogonal.ts';
import { validateAllOrthogonal } from '../../src/examples/hypergeometric/validate.ts';
console.log(`catalog size: ${CATALOG_EXAMPLES.length}`);
validateAllOrthogonal(CATALOG_EXAMPLES);
