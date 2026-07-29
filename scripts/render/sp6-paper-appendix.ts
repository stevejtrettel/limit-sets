/**
 * Offline density render of an appendix figure — a thin plugin over
 * scripts/render/renderDriver.ts. See that file for the shared flags and the two
 * render modes (view-preset vs auto).
 *
 *   node scripts/render/sp6-paper-appendix.ts o41 18
 *   node scripts/render/sp6-paper-appendix.ts t2-3 18 --tone 0.5 --gamma 0.8
 *
 * ids are the figure ids, not atlas ids: t2-1 … t2-7 and o41.
 *
 * FRAMING. Frame the figure in the `sp6-paper-appendix` demo and hit "save
 * framing for render"; that writes outputs/presets/sp6-paper-appendix-view-preset.json,
 * which this script reads by default and which pins the camera, the chart and
 * the figure. `--no-preset` forces the PCA autofit instead. Since a preset holds
 * exactly one figure, rendering the whole set means re-framing each one — or
 * running the others with `--no-preset`.
 *
 * SEEDING is the pinned γ = B⁻¹TBT for every figure, the same word the demo and
 * the paper use, so a rendered figure is reproducible from the text. The banner
 * reports that figure's spectral gap |λ₁/λ₂| and flags it if it falls under the
 * threshold the figure set is held to.
 *
 * TONE. These limit sets are thin, so a deep render concentrates a lot of hits
 * on few pixels and the default 0.999 clip percentile can wash the picture out.
 * If a figure comes out faint, lower `--tone` (0.4–0.6) and adjust `--gamma`
 * rather than switching to `--bg black`: the house rule is figures on white.
 */
import { runRender } from './renderDriver.ts';
import {
  FIGURES, figureExample, figureAction, seedAppendixFigure, APPENDIX_MIN_GAP,
  type AppendixFigure,
} from '../../src/examples/hypergeometric/paperAppendixFigures.ts';
import { paletteForOrthogonal } from '../../src/examples/hypergeometric/palette.ts';
import type { ViewPreset } from '../../src/examples/hypergeometric/viewPreset.ts';
import { embeddingFromPreset } from '../../src/core/viewPreset.ts';
import { fitAutoChartEmbedding } from '../../src/core/chart.ts';

await runRender<AppendixFigure>({
  family: 'sp6-paper-appendix', defaultExampleId: 'o41', defaultDepth: 18,
  resolveExample: (id) => FIGURES.find((f) => f.id === id),
  exampleId: (f) => f.id,
  banner: (f) => {
    const ex = figureExample(f);
    return `${f.label} — ${ex.type} · this paper: ${f.row} · atlas ${ex.label} (published: ${ex.status})`;
  },
  makeAction: (f) => figureAction(f),
  findSeed: (action) => {
    const s = seedAppendixFigure(action);
    const warn = s.meetsGap ? '' : `  ⚠ gap below ${APPENDIX_MIN_GAP}`;
    return {
      basepoint: s.basepoint,
      note: `γ = ${s.name} (pinned), |λ₁| ≈ ${s.lambdaMax.toFixed(4)}, `
        + `gap |λ₁/λ₂| = ${s.gap.toFixed(2)}, drift = ${s.drift.toExponential(2)}${warn}`,
    };
  },
  paletteForScheme: paletteForOrthogonal,
  fitEmbedding: (pilot) => fitAutoChartEmbedding(pilot),
  presetEmbedding: (preset) => embeddingFromPreset((preset as unknown as ViewPreset).projection),
});
