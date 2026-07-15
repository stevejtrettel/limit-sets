/**
 * Offline density render of an SU(2,1) limit set on ∂CH² = S³ — a thin plugin
 * over scripts/renderDriver.ts. su21 uses fixed embeddings, picked with
 * --embedding sphere-stereo|heisenberg (default sphere-stereo); the choice is
 * part of the cache key + filename.
 *   node scripts/render/su21-render-limit-set.ts ideal-triangle-A45 14 --embedding heisenberg
 */
import { runRender } from './renderDriver.ts';
import {
  EXAMPLES, buildAction, seedSU21, type SU21Example,
} from '../../src/examples/complex-hyperbolic/examples.ts';
import { stereographicEmbedding, heisenbergEmbedding } from '../../src/examples/complex-hyperbolic/embedding.ts';
import { paletteForScheme } from '../../src/examples/complex-hyperbolic/palette.ts';
import type { EmbeddingName, ViewPreset } from '../../src/examples/complex-hyperbolic/viewPreset.ts';

const flagVal = (n: string): string | null => {
  const i = process.argv.indexOf(n);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : null;
};
const EMBEDDING: EmbeddingName =
  flagVal('--embedding') === 'heisenberg' ? 'heisenberg' : 'sphere-stereo';
const fixed = (name: EmbeddingName) =>
  name === 'heisenberg' ? heisenbergEmbedding : stereographicEmbedding;

await runRender<SU21Example>({
  family: 'su21', defaultExampleId: 'ideal-triangle-A45', defaultDepth: 14,
  resolveExample: (id) => EXAMPLES.find((e) => e.id === id),
  exampleId: (e) => e.id,
  banner: (e) => `${e.label} [${e.id}]`,
  makeAction: (e) => buildAction(e),
  findSeed: (action, e) => {
    const s = seedSU21(e, action);
    return { basepoint: s.basepoint, note: `γ = ${s.name}, |λ_max| ≈ ${s.lambdaMax.toFixed(3)}` };
  },
  paletteForScheme,
  variant: (_e, preset) => (preset as unknown as ViewPreset | null)?.embedding ?? EMBEDDING,
  fitEmbedding: () => fixed(EMBEDDING),
  presetEmbedding: (preset) => fixed((preset as unknown as ViewPreset).embedding),
});
