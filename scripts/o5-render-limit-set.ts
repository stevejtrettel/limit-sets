/**
 * Offline density render of an O(5) limit set — a thin plugin over the shared
 * scripts/renderDriver.ts. See that file for flags and the two render modes
 * (view-preset vs auto). ids are g1…g77, e.g.:
 *   node scripts/o5-render-limit-set.ts g5 18 --gamma 0.5
 */
import { runRender } from './renderDriver.ts';
import { CATALOG_EXAMPLES } from '../src/o5/catalog.ts';
import type { O5Example } from '../src/o5/types.ts';
import { makeO5Action } from '../src/o5/action.ts';
import { loxodromicSeed } from '../src/o5/seed.ts';
import { embeddingFromPreset } from '../src/o5/embedding.ts';
import { paletteForScheme } from '../src/o5/palettes.ts';
import type { ViewPreset } from '../src/o5/viewPreset.ts';
import { fitAutoChartEmbedding } from '../src/core/chart.ts';

await runRender<O5Example>({
  family: 'o5', defaultExampleId: 'g1', defaultDepth: 16, numGenerators: 3,
  resolveExample: (id) => CATALOG_EXAMPLES.find((e) => e.id === id),
  exampleId: (e) => e.id,
  banner: (e) => `${e.label}${e.bdnLabel ? ` = ${e.bdnLabel}` : ''} (${e.type})`,
  makeAction: (e) => makeO5Action(e.coefflistf, e.coefflistg),
  findSeed: (action) => {
    const s = loxodromicSeed(action);
    return { basepoint: s.basepoint, note: `γ = ${s.name}${s.fallback ? ' (parabolic fallback)' : ''}: |λ_max| ≈ ${s.lambdaMax.toFixed(4)}, drift = ${s.drift.toFixed(6)}` };
  },
  paletteForScheme,
  fitEmbedding: (pilot) => fitAutoChartEmbedding(pilot),
  presetEmbedding: (preset) => embeddingFromPreset((preset as unknown as ViewPreset).projection),
});
