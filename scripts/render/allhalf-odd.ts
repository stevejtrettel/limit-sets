/**
 * Offline density render of an ODD all-half limit set — a thin plugin over
 * scripts/render/renderDriver.ts. See that file for the shared flags and the two
 * render modes (view-preset vs auto).
 *
 *   node scripts/render/allhalf-odd.ts allhalf-odd-d5 20
 *   node scripts/render/allhalf-odd.ts allhalf-odd-d13 20 --frame qframe
 *
 * ids are allhalf-odd-d5 … allhalf-odd-d25 (odd degrees only).
 *
 * --frame auto|qframe|normalform  (default qframe)
 *   Which geometric frame the AUTO-mode chart is fitted in. It joins the cache
 *   key and the filename, so the three are cached separately.
 *     auto        projective PCA on the companion-coordinate orbit. Keeps 100%
 *                 of the orbit at every degree, but flattens as d grows (3-D
 *                 spread 85/11/4 at d=5 → 97/2/1 at d=25).
 *     qframe      the invariant form congruence-diagonalized to diag(±1), then
 *                 fitted there. Retains 97–100% with a far better balanced
 *                 spread (64/36/0 at d=25) — the default, and the frame that
 *                 shows structure the auto-chart flattens away high in the tower.
 *     normalform  the Levelt coordinates ψ = P⁻¹x directly. Good at d = 5 and 7;
 *                 by d ≈ 9 it retains only ~50% and degenerates toward a line.
 *
 * Seeding is the family's fixed word γ = B²T, never the loxodromic search — both
 * generators are unipotent, so numeric root-finding would certify a parabolic as
 * loxodromic somewhere up the tower. See `all-half-odd.ts`.
 *
 * TWO THINGS THIS FAMILY NEEDS THAT MOST DO NOT.
 *
 * `--tone` matters more than usual. The limit set is thin (roughly
 * 1-dimensional), so a deep render piles millions of hits onto a few thousand
 * pixels: at d = 5, depth 22 the default 0.999 clip percentile lands around
 * 2.5e5 and washes the curve out to near-invisible. Something like
 * `--tone 0.4 --gamma 0.8` gives a readable image. Keep the white background and
 * fix visibility here, not with `--bg black`.
 *
 * AUTO-MODE FRAMING UNDER-COVERS AT HIGH DEPTH. The driver fits its bbox on a
 * pilot orbit capped at depth 12. For a Schottky group that is plenty — the
 * orbit has essentially converged by then. Here both generators are PARABOLIC,
 * so the orbit keeps creeping outward with depth (reaching distance ~1/k along a
 * cusp costs ~k letters), and a depth-22 render spills well outside a depth-12
 * bbox. For a framed figure, set the view in the demo and hit "save framing for
 * render" — preset mode then reproduces exactly that camera.
 */
import { runRender } from './renderDriver.ts';
import {
  EXAMPLES, allHalfOddAction, seedAllHalfOdd, type AllHalfOddExample,
} from '../../src/examples/hypergeometric/all-half-odd.ts';
import { qFrameChart, normalFormChart } from '../../src/examples/hypergeometric/all-half-odd-normal-form.ts';
import { paletteForOrthogonal } from '../../src/examples/hypergeometric/palette.ts';
import type { ViewPreset } from '../../src/examples/hypergeometric/viewPreset.ts';
import { embeddingFromPreset } from '../../src/core/viewPreset.ts';
import { fitAutoChartEmbedding } from '../../src/core/chart.ts';
import type { Orbit } from '../../src/core/orbit.ts';

type Frame = 'auto' | 'qframe' | 'normalform';

const flagVal = (n: string): string | null => {
  const i = process.argv.indexOf(n);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : null;
};
const raw = flagVal('--frame');
const FRAME: Frame =
  raw === 'auto' || raw === 'normalform' || raw === 'qframe' ? raw : 'qframe';
if (raw && raw !== FRAME) {
  process.stderr.write(`[allhalf-odd] unknown --frame '${raw}', using '${FRAME}'\n`);
}

const fit = (pilot: Orbit) =>
  FRAME === 'auto' ? fitAutoChartEmbedding(pilot)
  : FRAME === 'normalform' ? normalFormChart(pilot)
  : qFrameChart(pilot);

await runRender<AllHalfOddExample>({
  family: 'allhalf-odd', defaultExampleId: 'allhalf-odd-d5', defaultDepth: 20,
  resolveExample: (id) => EXAMPLES.find((e) => e.id === id),
  exampleId: (e) => e.id,
  banner: (e) => `${e.label} — Γ_d ⊂ O(${(e.d + 1) / 2}, ${(e.d - 1) / 2}) acting on RP^${e.d - 1}`
    + (e.d === 5 ? ' [= O(5) atlas #48]' : ''),
  variant: () => FRAME,
  makeAction: (e) => allHalfOddAction(e.d),
  findSeed: (action) => {
    const s = seedAllHalfOdd(action);
    return {
      basepoint: s.basepoint,
      note: `γ = ${s.name}, |λ_max| ≈ ${s.lambdaMax.toFixed(4)}, drift = ${s.drift.toExponential(2)}`,
    };
  },
  paletteForScheme: paletteForOrthogonal,
  extraValueFlags: ['--frame'],
  fitEmbedding: (pilot) => fit(pilot),
  presetEmbedding: (preset) => embeddingFromPreset((preset as unknown as ViewPreset).projection),
});
