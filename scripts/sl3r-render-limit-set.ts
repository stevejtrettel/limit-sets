/**
 * Offline density render of an SL(3,R)/convex-projective limit set — a thin
 * plugin over scripts/renderDriver.ts. Fixed embeddings, --embedding sphere|plane
 * (default plane), part of the cache key + filename.
 *   node scripts/sl3r-render-limit-set.ts tri-334-d1.0 16 --embedding plane
 */
import { runRender } from './renderDriver.ts';
import { EXAMPLES, seedTriangle, type MatrixGroupExample } from '../src/examples/projective/triangle-groups/data.ts';
import { makeMatrixAction, asInvolutions, pairWithInverses } from '../src/core/matrixAction.ts';
import { sphereEmbedding, planeEmbedding } from '../src/examples/projective/rp2.ts';
import { paletteForScheme } from '../src/examples/projective/triangle-groups/palette.ts';
import type { ViewPreset } from '../src/examples/projective/triangle-groups/viewPreset.ts';

const flagVal = (n: string): string | null => {
  const i = process.argv.indexOf(n);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : null;
};
const EMBEDDING: 'sphere' | 'plane' = flagVal('--embedding') === 'sphere' ? 'sphere' : 'plane';
const fixed = (name: 'sphere' | 'plane') => (name === 'sphere' ? sphereEmbedding : planeEmbedding);

await runRender<MatrixGroupExample>({
  family: 'sl3r', defaultExampleId: 'tri-334-d1.0', defaultDepth: 16,
  resolveExample: (id) => EXAMPLES.find((e) => e.id === id),
  exampleId: (e) => e.id,
  banner: (e) => `${e.label} [${e.id}]`,
  makeAction: (e) => makeMatrixAction(e.involutions ? asInvolutions(e.generators) : pairWithInverses(e.generators)),
  findSeed: (action) => {
    const s = seedTriangle(action);
    return { basepoint: s.basepoint, note: `γ = ${s.name}, |λ_max| ≈ ${s.lambdaMax.toFixed(3)}, drift = ${s.drift.toFixed(4)}` };
  },
  paletteForScheme,
  variant: (_e, preset) => (preset as unknown as ViewPreset | null)?.embedding ?? EMBEDDING,
  fitEmbedding: () => fixed(EMBEDDING),
  presetEmbedding: (preset) => fixed((preset as unknown as ViewPreset).embedding),
});
