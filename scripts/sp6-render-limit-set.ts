/**
 * Offline density render of an Sp(6,Z) limit set — a thin plugin over the shared
 * scripts/renderDriver.ts (see it for flags + the auto/view-preset modes).
 *   node scripts/sp6-render-limit-set.ts c32 14 --splat 1
 */
import { runRender } from './renderDriver.ts';
import { EXAMPLES, type Sp6Example } from '../src/sp6/examples.ts';
import { makeSp6Action } from '../src/sp6/action.ts';
import { embeddingFromPreset } from '../src/sp6/embedding.ts';
import { paletteForScheme } from '../src/sp6/palettes.ts';
import type { ViewPreset } from '../src/sp6/viewPreset.ts';
import { computeProximalBasepoint } from '../src/core/orbit.ts';
import { fitAutoChartEmbedding } from '../src/core/chart.ts';

await runRender<Sp6Example>({
  family: 'sp6', defaultExampleId: 'c32', defaultDepth: 13,
  resolveExample: (id) => EXAMPLES.find((e) => e.id === id),
  exampleId: (e) => e.id,
  banner: (e) => `${e.label} (${e.status})`,
  makeAction: (e) => makeSp6Action(e),
  findSeed: (action, e) => {
    const bp = computeProximalBasepoint(action, e.gamma, e.powerIter);
    return { basepoint: bp.basepoint, note: `|λ_max(${e.gammaName})| ≈ ${bp.lambdaMax.toFixed(3)}, drift = ${bp.drift.toFixed(4)}` };
  },
  paletteForScheme,
  fitEmbedding: (pilot) => fitAutoChartEmbedding(pilot),
  presetEmbedding: (preset) => embeddingFromPreset((preset as unknown as ViewPreset).projection),
});
