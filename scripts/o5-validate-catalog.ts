import { CATALOG_EXAMPLES } from '../src/o5/catalog.ts';
import { validateAllExamples } from '../src/o5/validate.ts';
console.log(`catalog size: ${CATALOG_EXAMPLES.length}`);
validateAllExamples(CATALOG_EXAMPLES);
