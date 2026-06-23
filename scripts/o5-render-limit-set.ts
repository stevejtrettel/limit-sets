/**
 * Offline density render of an O(5) limit set — a thin plugin over the shared
 * scripts/renderDriver.ts. See that file for flags and the two render modes
 * (view-preset vs auto). ids are g1…g77, e.g.:
 *   node scripts/o5-render-limit-set.ts g5 18 --gamma 0.5
 */
import { runRender } from './renderDriver.ts';
import {
  CATALOG_EXAMPLES, ORTHOGONAL_DEGREE5_WALK, type OrthogonalExample,
} from '../src/examples/hypergeometric/degree5-orthogonal.ts';
import { hypergeometricAction, WALK_LABELS, WALK_FALLBACK } from '../src/examples/hypergeometric/recipe.ts';
import { paletteForOrthogonal } from '../src/examples/hypergeometric/palette.ts';
import type { ViewPreset } from '../src/examples/hypergeometric/viewPreset.ts';
import { seedFromLoxodromic } from '../src/core/seed.ts';
import { embeddingFromPreset } from '../src/core/viewPreset.ts';
import { fitAutoChartEmbedding } from '../src/core/chart.ts';

await runRender<OrthogonalExample>({
  family: 'o5', defaultExampleId: 'g1', defaultDepth: 16,
  resolveExample: (id) => CATALOG_EXAMPLES.find((e) => e.id === id),
  exampleId: (e) => e.id,
  banner: (e) => `${e.label}${e.bdnLabel ? ` = ${e.bdnLabel}` : ''} (${e.type})`,
  makeAction: (e) => hypergeometricAction(e.alpha, e.beta, ORTHOGONAL_DEGREE5_WALK),
  findSeed: (action) => {
    const s = seedFromLoxodromic(action, {
      labels: WALK_LABELS[ORTHOGONAL_DEGREE5_WALK],
      fallbackWord: WALK_FALLBACK[ORTHOGONAL_DEGREE5_WALK],
    });
    return { basepoint: s.basepoint, note: `γ = ${s.name}${s.fallback ? ' (parabolic fallback)' : ''}: |λ_max| ≈ ${s.lambdaMax.toFixed(4)}, drift = ${s.drift.toFixed(6)}` };
  },
  paletteForScheme: paletteForOrthogonal,
  fitEmbedding: (pilot) => fitAutoChartEmbedding(pilot),
  presetEmbedding: (preset) => embeddingFromPreset((preset as unknown as ViewPreset).projection),
});
