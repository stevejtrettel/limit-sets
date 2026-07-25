/**
 * Offline density render of an SL(7,ℝ) three-involution limit set in RP⁶ — a
 * thin plugin over scripts/render/renderDriver.ts.
 *   node scripts/render/sl7-render-limit-set.ts goldman-parker-7 16
 */
import { runRender } from './renderDriver.ts';
import { EXAMPLES, seedRP6, type RP6Example } from '../../src/examples/projective/rp6-triples/data.ts';
import { paletteForScheme } from '../../src/examples/projective/rp6-triples/palette.ts';
import type { ViewPreset } from '../../src/examples/projective/rp6-triples/viewPreset.ts';
import { makeMatrixAction, asInvolutions } from '../../src/core/matrixAction.ts';
import { embeddingFromPreset } from '../../src/core/viewPreset.ts';
import { fitAutoChartEmbedding } from '../../src/core/chart.ts';

await runRender<RP6Example>({
  family: 'sl7', defaultExampleId: 'goldman-parker-7', defaultDepth: 15,
  resolveExample: (id) => EXAMPLES.find((e) => e.id === id),
  exampleId: (e) => e.id,
  banner: (e) => e.label,
  makeAction: (e) => makeMatrixAction(asInvolutions(e.generators)),
  findSeed: (action) => {
    const s = seedRP6(action);
    return { basepoint: s.basepoint, note: `γ = ${s.name}, |λ_max| ≈ ${s.lambdaMax.toFixed(3)}, drift = ${s.drift.toFixed(4)}` };
  },
  paletteForScheme,
  fitEmbedding: (pilot) => fitAutoChartEmbedding(pilot),
  presetEmbedding: (preset) => embeddingFromPreset((preset as unknown as ViewPreset).projection),
});
