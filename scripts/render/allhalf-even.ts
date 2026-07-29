/**
 * Offline density render of an EVEN all-half limit set — a thin plugin over
 * scripts/render/renderDriver.ts. See that file for the shared flags and the two
 * render modes (view-preset vs auto).
 *
 *   node scripts/render/allhalf-even.ts allhalf-even-d4 16
 *   node scripts/render/allhalf-even.ts allhalf-even-d8 14 --frame normalform
 *
 * ids are allhalf-even-d4 … allhalf-even-d24 (even degrees only).
 *
 * --frame auto|normalform  (default auto)
 *   Joins the cache key and the filename, so the two are cached separately.
 *     auto        projective PCA on the companion-coordinate orbit.
 *     normalform  the Levelt coordinates ψ = P⁻¹x. Degrades with d the same way
 *                 it does in the odd tower — by d ≈ 24 it projects the limit set
 *                 close to a line.
 *
 *   There is deliberately no `qframe` here. The odd tower's Q-frame comes from
 *   congruence-diagonalizing its SYMMETRIC form to diag(±1), which is canonical
 *   because the signature is an invariant. This tower's form is ALTERNATING:
 *   every full-rank symplectic form is equivalent to the standard one and
 *   Sp(d,ℝ) acts transitively on Darboux frames, so a "symplectic frame" would
 *   be an arbitrary choice carrying nothing the auto-chart lacks.
 *
 * DEPTH COSTS MORE THAN THE ODD TOWER. T is a transvection rather than a
 * reflection, so there is no free-product structure to exploit and the walk is
 * the plain free group on {A, A⁻¹, T, T⁻¹} — a 3^N tree against the odd tower's
 * 2^N. Depth 16 here is ≈86M words, against ≈196k at the same depth for odd.
 * The driver streams the orbit (O(depth) memory), so the cost is time, not RAM.
 *
 * Seeding is the family's fixed word γ = T⁻¹A, never the loxodromic search —
 * both generators are unipotent. See `all-half-even.ts`.
 *
 * TWO THINGS THIS FAMILY NEEDS THAT MOST DO NOT.
 *
 * `--tone` matters more than usual. The limit set is thin, so a deep render
 * piles millions of hits onto a few thousand pixels and the default 0.999 clip
 * percentile washes it out. Something like `--tone 0.4 --gamma 0.8` gives a
 * readable image. Keep the white background and fix visibility here, not with
 * `--bg black`.
 *
 * AUTO-MODE FRAMING UNDER-COVERS AT HIGH DEPTH. The driver fits its bbox on a
 * pilot orbit capped at depth 12. Both generators here are PARABOLIC, so the
 * orbit keeps creeping outward with depth rather than converging, and a deep
 * render spills outside a depth-12 bbox. For a framed figure, set the view in
 * the demo and hit "save framing for render"; preset mode then reproduces that
 * camera exactly (and the preset's exampleId and depth win over the CLI — pass
 * `--no-preset` to force auto mode).
 */
import { runRender } from './renderDriver.ts';
import {
  EXAMPLES, allHalfEvenAction, seedAllHalfEven, type AllHalfEvenExample,
} from '../../src/examples/hypergeometric/all-half-even.ts';
import { normalFormChart } from '../../src/examples/hypergeometric/all-half-even-normal-form.ts';
import { paletteForSymplectic } from '../../src/examples/hypergeometric/palette.ts';
import type { ViewPreset } from '../../src/examples/hypergeometric/viewPreset.ts';
import { embeddingFromPreset } from '../../src/core/viewPreset.ts';
import { fitAutoChartEmbedding } from '../../src/core/chart.ts';
import type { Orbit } from '../../src/core/orbit.ts';

type Frame = 'auto' | 'normalform';

const flagVal = (n: string): string | null => {
  const i = process.argv.indexOf(n);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : null;
};
const raw = flagVal('--frame');
const FRAME: Frame = raw === 'normalform' ? 'normalform' : 'auto';
if (raw && raw !== FRAME) {
  process.stderr.write(`[allhalf-even] unknown --frame '${raw}', using '${FRAME}'\n`);
}

const fit = (pilot: Orbit) =>
  FRAME === 'normalform' ? normalFormChart(pilot) : fitAutoChartEmbedding(pilot);

await runRender<AllHalfEvenExample>({
  family: 'allhalf-even', defaultExampleId: 'allhalf-even-d4', defaultDepth: 14,
  resolveExample: (id) => EXAMPLES.find((e) => e.id === id),
  exampleId: (e) => e.id,
  banner: (e) => `${e.label} — Γ_d ⊂ Sp(${e.d}, ℝ) acting on RP^${e.d - 1}, Γ_d ≅ F₂`,
  variant: () => FRAME,
  makeAction: (e) => allHalfEvenAction(e.d),
  findSeed: (action) => {
    const s = seedAllHalfEven(action);
    return {
      basepoint: s.basepoint,
      note: `γ = ${s.name}, |λ_max| ≈ ${s.lambdaMax.toFixed(4)}, drift = ${s.drift.toExponential(2)}`,
    };
  },
  paletteForScheme: paletteForSymplectic,
  extraValueFlags: ['--frame'],
  fitEmbedding: (pilot) => fit(pilot),
  presetEmbedding: (preset) => embeddingFromPreset((preset as unknown as ViewPreset).projection),
});
