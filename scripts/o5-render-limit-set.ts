/**
 * o5-render-limit-set.ts — offline density render of an O(5) limit set.
 *
 *   node scripts/o5-render-limit-set.ts <exampleId> [depth] [--max-dim N] [--gamma G]
 *
 * Auto-chart mode only (PCA pilot + percentile-bbox autofit, orthographic).
 * Streams the {T,B} word tree by DFS into a grayscale accumulator, tone-maps,
 * writes an 8-bit PNG at the repo root. Group math from src/o5/, render pieces
 * from src/render/, orchestration from src/core/projector.
 */

import { createAccumulator } from '../src/render/accumulator.ts';
import { accumulatorToRGBA, type Bg } from '../src/render/tone.ts';
import { writePng } from '../src/render/png.ts';
import { createProgress, formatCount } from '../src/render/progress.ts';
import { makeIntegerDeposit } from '../src/render/splat.ts';

import { CATALOG_EXAMPLES } from '../src/o5/catalog.ts';
import { makeO5Action } from '../src/o5/action.ts';
import { loxodromicSeed } from '../src/o5/seed.ts';
import { streamOrbit } from '../src/core/orbit.ts';
import { fitAutoChartEmbedding } from '../src/core/chart.ts';
import { makeAutoProjector } from '../src/core/projector.ts';

const log = (m: string): void => { process.stderr.write(m + '\n'); };

const ARGS = process.argv.slice(2);
function flag(name: string): string | null {
  const i = ARGS.indexOf(name);
  return i >= 0 && i + 1 < ARGS.length ? ARGS[i + 1] : null;
}
const positional = ARGS.filter((a, i) => !a.startsWith('--') && ARGS[i - 1]?.startsWith('--') !== true);

const EXAMPLE_ID = positional[0] ?? 'o41-1';
const DEPTH = positional[1] ? parseInt(positional[1], 10) : 16;
const MAX_DIM = flag('--max-dim') ? parseInt(flag('--max-dim')!, 10) : 2000;
const TONE_GAMMA = flag('--gamma') ? parseFloat(flag('--gamma')!) : 1;
const BG: Bg = flag('--bg') === 'black' ? 'black' : 'white';
const TONE_PERCENTILE = 0.999;

const ex = CATALOG_EXAMPLES.find((e) => e.id === EXAMPLE_ID);
if (!ex) {
  log(`[o5-render] unknown id '${EXAMPLE_ID}'. Available: ${CATALOG_EXAMPLES.map((e) => e.id).join(', ')}`);
  process.exit(1);
}
log(`[o5-render] ${ex.label} (${ex.type})  depth=${DEPTH}  max-dim=${MAX_DIM}  gamma=${TONE_GAMMA}  bg=${BG}`);

const action = makeO5Action(ex.coefflistf, ex.coefflistg);
const bp = loxodromicSeed(action);
log(`[o5-render] seed γ = ${bp.name}${bp.fallback ? ' (parabolic fallback)' : ''}: |λ_max| ≈ ${bp.lambdaMax.toFixed(4)}, drift = ${bp.drift.toFixed(6)}`);

const { project, imgW, imgH } = makeAutoProjector({
  action, basepoint: bp.basepoint, depth: DEPTH, pilotDepth: Math.min(DEPTH, 12),
  fitEmbedding: fitAutoChartEmbedding,
  maxDim: MAX_DIM, minDim: 128, dimRound: 16, bboxTrim: 0.20, maxAspect: 4, fitFill: 0.92, log,
});

const acc = createAccumulator(imgW, imgH, 1);
const deposit = makeIntegerDeposit(acc.data, imgW, imgH, 1);
const total = 1 + 3 * (2 ** DEPTH - 1);
log(`Streaming DFS depth=${DEPTH} → ${imgW}×${imgH} (${formatCount(total)} nodes)...`);

let drawn = 0;
const prog = createProgress({ total, label: 'DFS', extra: () => `drawn ${formatCount(drawn)}` });
streamOrbit(action, bp.basepoint, DEPTH, (vecs, off) => {
  prog.tick();
  const p = project(vecs, off);
  if (p === null) return;
  if (deposit(p.px, p.py, 0)) drawn++;
});
prog.done();
log(`  DFS done: drawn ${drawn.toLocaleString()} in ${prog.elapsed.toFixed(1)}s`);

const { rgba, scale } = accumulatorToRGBA(acc, { percentile: TONE_PERCENTILE, bg: BG, gamma: TONE_GAMMA });
log(`  nonzero ${scale.nzCount.toLocaleString()}  clip ${scale.clip.toFixed(3)}`);

const outputFile = `o5-${EXAMPLE_ID}-depth${DEPTH}-${imgW}x${imgH}.png`;
await writePng(outputFile, imgW, imgH, rgba);
log(`[o5-render] wrote ${outputFile}`);
