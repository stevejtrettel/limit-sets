/**
 * Offline density render of an SL(2,C)/Möbius limit set — a thin plugin over
 * scripts/renderDriver.ts. sl2c uses fixed embeddings, picked with --embedding
 * sphere|plane (default plane); the choice is part of the cache key + filename.
 *   node scripts/sl2c-render-limit-set.ts riley-2i 14 --embedding sphere
 */
import { runRender } from './renderDriver.ts';
import { EXAMPLES, type MobiusExample } from '../src/sl2c/examples.ts';
import { makeMobiusAction } from '../src/sl2c/action.ts';
import { sphereEmbedding, planeEmbedding } from '../src/sl2c/embedding.ts';
import { paletteForScheme } from '../src/sl2c/palettes.ts';
import type { ViewPreset } from '../src/sl2c/viewPreset.ts';
import { computeProximalBasepoint } from '../src/core/orbit.ts';

const flagVal = (n: string): string | null => {
  const i = process.argv.indexOf(n);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : null;
};
const EMBEDDING: 'sphere' | 'plane' = flagVal('--embedding') === 'sphere' ? 'sphere' : 'plane';
const fixed = (name: 'sphere' | 'plane') => (name === 'sphere' ? sphereEmbedding : planeEmbedding);

await runRender<MobiusExample>({
  family: 'sl2c', defaultExampleId: 'riley-2i', defaultDepth: 13,
  resolveExample: (id) => EXAMPLES.find((e) => e.id === id),
  exampleId: (e) => e.id,
  banner: (e) => `${e.label} [${e.id}]`,
  makeAction: (e) => makeMobiusAction(e.generators),
  findSeed: (action, e) => {
    const bp = computeProximalBasepoint(action, e.gamma, e.powerIter);
    return { basepoint: bp.basepoint, note: `|λ_max(${e.gammaName})| ≈ ${bp.lambdaMax.toFixed(3)}, drift = ${bp.drift.toFixed(4)}` };
  },
  paletteForScheme,
  variant: (_e, preset) => (preset as unknown as ViewPreset | null)?.embedding ?? EMBEDDING,
  fitEmbedding: () => fixed(EMBEDDING),
  presetEmbedding: (preset) => fixed((preset as unknown as ViewPreset).embedding),
});
