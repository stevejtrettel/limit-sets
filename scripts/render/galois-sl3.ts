/**
 * Offline density render of a Galois-embedded SL(3,ℤ[√d]) limit set in RP⁵ — a
 * thin plugin over scripts/render/renderDriver.ts.
 *
 *   node scripts/render/galois-sl3.ts                 # default example, preset view
 *   node scripts/render/galois-sl3.ts phi 16          # auto-fit at depth 16
 *   node scripts/render/galois-sl3.ts sqrt3 15 --seed factor1
 *
 * The seed mode is part of the MATHEMATICS, not the framing, so it is resolved
 * here rather than by the driver: `--seed` wins, else the exported view preset's
 * `seedMode`, else the joined basepoint. It is also mixed into the render variant
 * so the cache key and output filename keep the three modes apart.
 */

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { runRender } from './renderDriver.ts';
import { EXAMPLES, type GaloisExample } from '../../src/examples/galois-sl3/catalog.ts';
import { galoisAction, seedFor, seedGalois, type SeedMode } from '../../src/examples/galois-sl3/recipe.ts';
import { paletteForScheme } from '../../src/examples/galois-sl3/palette.ts';
import type { ViewPreset } from '../../src/examples/galois-sl3/viewPreset.ts';
import { embeddingFromPreset } from '../../src/core/viewPreset.ts';
import { fitAutoChartEmbedding } from '../../src/core/chart.ts';

const SEED_MODES: readonly SeedMode[] = ['join', 'factor1', 'factor2'];

function resolveSeedMode(): SeedMode {
  const args = process.argv.slice(2);
  const i = args.indexOf('--seed');
  if (i >= 0 && i + 1 < args.length) {
    const v = args[i + 1] as SeedMode;
    if (!SEED_MODES.includes(v)) {
      throw new Error(`--seed must be one of ${SEED_MODES.join(' | ')}, got '${v}'`);
    }
    return v;
  }
  if (!args.includes('--no-preset')) {
    const p = fileURLToPath(new URL('../../outputs/presets/galois-sl3-view-preset.json', import.meta.url));
    if (existsSync(p)) {
      try {
        const preset = JSON.parse(readFileSync(p, 'utf8')) as ViewPreset;
        if (preset.seedMode && SEED_MODES.includes(preset.seedMode)) return preset.seedMode;
      } catch { /* driver reports malformed presets */ }
    }
  }
  return 'join';
}

const seedMode = resolveSeedMode();

await runRender<GaloisExample>({
  family: 'galois-sl3', defaultExampleId: 'phi', defaultDepth: 15,
  resolveExample: (id) => EXAMPLES.find((e) => e.id === id),
  exampleId: (e) => e.id,
  banner: (e) => `${e.label}  seed=${seedMode}`,
  variant: () => seedMode,
  extraValueFlags: ['--seed'],
  makeAction: (e) => galoisAction(e.unit),
  findSeed: (_action, e) => {
    const s = seedFor(e.unit, seedMode);
    const note = seedMode === 'join'
      ? (() => {
          const j = seedGalois(e.unit);
          return `γ = ${j.name} proximal in both factors, |λ| = [${j.blockLambdaMax.map((l) => l.toFixed(3)).join(', ')}], ` +
                 `gap = ${j.minGap.toFixed(4)}, drift = ${j.drift.toExponential(2)}`;
        })()
      : `γ = ${s.name} (single factor — orbit stays in that plane), |λ| ≈ ${s.lambdaMax.toFixed(3)}`;
    return { basepoint: s.basepoint, note };
  },
  paletteForScheme,
  fitEmbedding: (pilot) => fitAutoChartEmbedding(pilot),
  presetEmbedding: (preset) => embeddingFromPreset((preset as unknown as ViewPreset).projection),
});
