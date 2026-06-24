/**
 * Offline density render of an Sp(6,Z) limit set — a thin plugin over the shared
 * scripts/renderDriver.ts (see it for flags + the auto/view-preset modes).
 *   node scripts/sp6-render-limit-set.ts c32 14 --splat 1
 */
import { runRender } from './renderDriver.ts';
import {
  EXAMPLES, symplecticAction, type SymplecticExample,
} from '../src/examples/hypergeometric/degree6-symplectic.ts';
import { paletteForSymplectic } from '../src/examples/hypergeometric/palette.ts';
import type { ViewPreset } from '../src/examples/hypergeometric/viewPreset.ts';
import { computeProximalBasepoint } from '../src/core/orbit.ts';
import { embeddingFromPreset } from '../src/core/viewPreset.ts';
import { fitAutoChartEmbedding } from '../src/core/chart.ts';

await runRender<SymplecticExample>({
  family: 'sp6', defaultExampleId: 'c32', defaultDepth: 13,
  resolveExample: (id) => EXAMPLES.find((e) => e.id === id),
  exampleId: (e) => e.id,
  banner: (e) => `${e.label} (${e.status})`,
  makeAction: (e) => symplecticAction(e),
  findSeed: (action, e) => {
    const bp = computeProximalBasepoint(action, e.gamma, e.powerIter);
    return { basepoint: bp.basepoint, note: `|λ_max(${e.gammaName})| ≈ ${bp.lambdaMax.toFixed(3)}, drift = ${bp.drift.toFixed(4)}` };
  },
  paletteForScheme: paletteForSymplectic,
  fitEmbedding: (pilot) => fitAutoChartEmbedding(pilot),
  presetEmbedding: (preset) => embeddingFromPreset((preset as unknown as ViewPreset).projection),
});
