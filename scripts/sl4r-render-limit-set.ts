/**
 * Offline density render of an SL(4,R)/GL(4,R) limit set — a thin plugin over
 * scripts/renderDriver.ts.
 *   node scripts/sl4r-render-limit-set.ts pair1 16
 */
import { runRender } from './renderDriver.ts';
import { EXAMPLES, type RP3Example } from '../src/examples/projective/rp3-pairs/data.ts';
import { paletteForScheme } from '../src/examples/projective/rp3-pairs/palette.ts';
import type { ViewPreset } from '../src/examples/projective/rp3-pairs/viewPreset.ts';
import { makeMatrixAction, asInvolutions, pairWithInverses } from '../src/core/matrixAction.ts';
import { computeProximalBasepoint } from '../src/core/orbit.ts';
import { embeddingFromPreset } from '../src/core/viewPreset.ts';
import { fitAutoChartEmbedding } from '../src/core/chart.ts';

await runRender<RP3Example>({
  family: 'sl4r', defaultExampleId: 'pair1', defaultDepth: 13,
  resolveExample: (id) => EXAMPLES.find((e) => e.id === id),
  exampleId: (e) => e.id,
  banner: (e) => e.label,
  makeAction: (e) => makeMatrixAction(e.involutions ? asInvolutions(e.generators) : pairWithInverses(e.generators)),
  findSeed: (action, e) => {
    const bp = computeProximalBasepoint(action, e.gamma, e.powerIter);
    return { basepoint: bp.basepoint, note: `|λ_max(${e.gammaName})| ≈ ${bp.lambdaMax.toFixed(3)}, drift = ${bp.drift.toFixed(4)}` };
  },
  paletteForScheme,
  fitEmbedding: (pilot) => fitAutoChartEmbedding(pilot),
  presetEmbedding: (preset) => embeddingFromPreset((preset as unknown as ViewPreset).projection),
});
