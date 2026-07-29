/**
 * Offline density render of the SL(7,ℝ) Goldman–Parker triple restricted to its
 * invariant RP² — a thin plugin over scripts/render/renderDriver.ts. Fixed
 * embeddings, --embedding plane|sphere (default plane), part of the cache key +
 * filename.
 *
 * The limit set covers RP², so no affine chart avoids the line at infinity; the
 * plane view just projects (x/z, y/z) and lets the autofit's percentile bbox
 * drop the few runaway points. 'sphere' is the always-bounded unit-S² view.
 *   node scripts/render/sl7-rp2.ts goldman-parker-7 18 --embedding plane
 */
import { runRender } from './renderDriver.ts';
import { EXAMPLES, type RP6Example } from '../../src/examples/projective/rp6-triples/data.ts';
import { restrictToRP2 } from '../../src/examples/projective/rp6-triples/rp2.ts';
import { paletteForScheme } from '../../src/examples/projective/rp6-triples/palette.ts';
import type { ViewPreset } from '../../src/examples/projective/rp6-triples/rp2ViewPreset.ts';
import { sphereEmbedding, planeEmbedding } from '../../src/examples/projective/rp2.ts';
import { seedFromLoxodromic, makeRealDominantCriterion } from '../../src/core/seed.ts';

const flagVal = (n: string): string | null => {
  const i = process.argv.indexOf(n);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : null;
};
const EMBEDDING: 'plane' | 'sphere' = flagVal('--embedding') === 'sphere' ? 'sphere' : 'plane';
const fixed = (name: 'plane' | 'sphere') => (name === 'sphere' ? sphereEmbedding : planeEmbedding);
const criterion = makeRealDominantCriterion({ expand: 1.05 });

await runRender<RP6Example>({
  family: 'sl7rp2', defaultExampleId: 'goldman-parker-7', defaultDepth: 18,
  resolveExample: (id) => EXAMPLES.find((e) => e.id === id),
  exampleId: (e) => e.id,
  banner: (e) => `${e.label} → invariant RP²`,
  makeAction: (e) => restrictToRP2(e).action,
  findSeed: (action) => {
    const s = seedFromLoxodromic(action, { criterion, labels: ['g₁', 'g₂', 'g₃'] });
    return { basepoint: s.basepoint, note: `γ = ${s.name}, |λ_max| ≈ ${s.lambdaMax.toFixed(3)}, drift = ${s.drift.toFixed(4)}` };
  },
  paletteForScheme,
  variant: (_e, preset) => (preset as unknown as ViewPreset | null)?.embedding ?? EMBEDDING,
  fitEmbedding: () => fixed(EMBEDDING),
  presetEmbedding: (preset) => fixed((preset as unknown as ViewPreset).embedding),
});
