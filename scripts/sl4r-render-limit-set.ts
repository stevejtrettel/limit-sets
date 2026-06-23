/**
 * Offline density render of an SL(4,R)/GL(4,R) limit set — a thin plugin over
 * scripts/renderDriver.ts.
 *   node scripts/sl4r-render-limit-set.ts pair1 16
 */
import { runRender } from './renderDriver.ts';
import { EXAMPLES, type SL4RExample } from '../demos/sl4r-limit-sets/pair1.ts';
import { makeMat4Action } from '../src/sl4r/action.ts';
import { embeddingFromPreset } from '../src/sl4r/embedding.ts';
import { paletteForScheme } from '../src/sl4r/palettes.ts';
import type { ViewPreset } from '../src/sl4r/viewPreset.ts';
import { computeProximalBasepoint } from '../src/core/orbit.ts';
import { fitAutoChartEmbedding } from '../src/core/chart.ts';

await runRender<SL4RExample>({
  family: 'sl4r', defaultExampleId: 'pair1', defaultDepth: 13,
  resolveExample: (id) => EXAMPLES.find((e) => e.id === id),
  exampleId: (e) => e.id,
  banner: (e) => e.label,
  makeAction: (e) => makeMat4Action(e.generators, { involutions: e.involutions }),
  findSeed: (action, e) => {
    const bp = computeProximalBasepoint(action, e.gamma, e.powerIter);
    return { basepoint: bp.basepoint, note: `|λ_max(${e.gammaName})| ≈ ${bp.lambdaMax.toFixed(3)}, drift = ${bp.drift.toFixed(4)}` };
  },
  paletteForScheme,
  fitEmbedding: (pilot) => fitAutoChartEmbedding(pilot),
  presetEmbedding: (preset) => embeddingFromPreset((preset as unknown as ViewPreset).projection),
});
