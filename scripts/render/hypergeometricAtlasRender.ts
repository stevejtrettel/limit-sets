/**
 * Offline density render of a hypergeometric limit set — the shared plugin body
 * over scripts/render/renderDriver.ts, parameterised by the catalog. See
 * renderDriver.ts for flags and the two render modes (view-preset vs auto).
 * The per-atlas entry points are hypergeometric-atlas.ts (degree ≤ 6) and
 * hypergeometric-deg7.ts.
 */
import { runRender } from './renderDriver.ts';
import type { AtlasCatalog, AtlasExample } from '../../src/examples/hypergeometric/atlasCatalog.ts';
import { hypergeometricAction, WALK_LABELS, WALK_FALLBACK } from '../../src/examples/hypergeometric/recipe.ts';
import { paletteForOrthogonal, paletteForSymplectic } from '../../src/examples/hypergeometric/palette.ts';
import type { ViewPreset } from '../../src/examples/hypergeometric/viewPreset.ts';
import { seedFromLoxodromic } from '../../src/core/seed.ts';
import { embeddingFromPreset } from '../../src/core/viewPreset.ts';
import { fitAutoChartEmbedding } from '../../src/core/chart.ts';

export interface AtlasRenderConfig {
  catalog: AtlasCatalog;
  /** Preset group tag — matches the demo's, so a saved framing is found. */
  family: string;
  defaultExampleId: string;
  defaultDepth: number;
}

export function renderHypergeometricAtlas(cfg: AtlasRenderConfig): Promise<void> {
  // The palette follows the walk of whichever example is being rendered.
  let activeWalkPalette = paletteForOrthogonal;

  return runRender<AtlasExample>({
    family: cfg.family,
    defaultExampleId: cfg.defaultExampleId,
    defaultDepth: cfg.defaultDepth,
    resolveExample: (id) => {
      const e = cfg.catalog.exampleById(id);
      if (e?.table.finite) throw new Error(`${id} is ${e.table.form} (definite) — finite group, no limit set to render`);
      if (e) activeWalkPalette = e.table.walk === 'free-product' ? paletteForOrthogonal : paletteForSymplectic;
      return e;
    },
    exampleId: (e) => e.id,
    banner: (e) => `${e.id} (${e.table.form}, walk ${e.table.walk})`,
    makeAction: (e) => hypergeometricAction(e.alpha, e.beta, e.table.walk),
    findSeed: (action, e) => {
      const s = seedFromLoxodromic(action, {
        labels: WALK_LABELS[e.table.walk],
        fallbackWord: WALK_FALLBACK[e.table.walk],
      });
      return { basepoint: s.basepoint, note: `γ = ${s.name}${s.fallback ? ' (parabolic fallback)' : ''}: |λ_max| ≈ ${s.lambdaMax.toFixed(4)}, drift = ${s.drift.toFixed(6)}` };
    },
    paletteForScheme: (scheme) => activeWalkPalette(scheme),
    fitEmbedding: (pilot) => fitAutoChartEmbedding(pilot),
    presetEmbedding: (preset) => embeddingFromPreset((preset as unknown as ViewPreset).projection),
  });
}
