/**
 * Offline density render of a finite (p,q,r) complex hyperbolic triangle
 * group limit set — thin plugin over scripts/renderDriver.ts.
 *
 * Configuration is continuous: the demo's preset carries { orders, phase }.
 * Without a preset (or with --no-preset), flags configure it:
 *
 *   node scripts/render/su21-triangle-groups.ts --depth 16 \
 *        --n 4,4,4 --phase 5.073756 [--critical | --order n] [--embedding heisenberg]
 *
 * --critical solves f(1213) = 0 on (π, φmax) and renders exactly at the
 * parabolic point; --order n renders where 1213 is elliptic of projective
 * order n (both are Rich Schwartz's R-circle-closure regime).
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runRender } from './renderDriver.ts';
import { classifyElement, wordProduct } from '../../src/examples/complex-hyperbolic/diagnostics.ts';
import {
  WORD_1213, triangleGroupReflections, triangleGroupAction, seedTriangleGroup,
  findParabolicPhase, findEllipticPhase,
  type TriangleOrders,
} from '../../src/examples/complex-hyperbolic/triangleGroup.ts';
import { stereographicEmbedding, heisenbergEmbedding } from '../../src/examples/complex-hyperbolic/embedding.ts';
import { paletteForScheme } from '../../src/examples/complex-hyperbolic/palette.ts';
import { triSlug, type EmbeddingName, type TriViewPreset } from '../../src/examples/complex-hyperbolic/triViewPreset.ts';

const argv = process.argv;
const flagVal = (n: string): string | null => {
  const i = argv.indexOf(n);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null;
};

let orders: TriangleOrders = [4, 4, 4];
{
  const v = flagVal('--n');   // e.g. --n 4,4,4
  if (v) {
    const parts = v.split(/[,x-]/).map((s) => parseInt(s, 10));
    if (parts.length === 3 && parts.every(Number.isFinite)) orders = parts as unknown as TriangleOrders;
    else { console.error(`[su21-tri-render] bad --n '${v}' (expected e.g. 4,4,4)`); process.exit(1); }
  }
}
let phase = flagVal('--phase') ? parseFloat(flagVal('--phase')!) : Math.PI;

// Preset (written by the demo) wins unless --no-preset.
const PRESET_PATH = fileURLToPath(new URL('../../outputs/presets/su21-tri-view-preset.json', import.meta.url));
if (!argv.includes('--no-preset') && existsSync(PRESET_PATH)) {
  try {
    const p = JSON.parse(readFileSync(PRESET_PATH, 'utf8')) as TriViewPreset;
    if (p.orders && p.phase !== undefined) { orders = p.orders; phase = p.phase; }
  } catch { /* fall through to flags */ }
}

if (argv.includes('--critical')) {
  const phiC = findParabolicPhase(orders);
  if (phiC === null) {
    console.error('[su21-tri-render] --critical: no parabolic phase of 1213 on (π, φmax)');
    process.exit(1);
  }
  phase = phiC;
  console.log(`[su21-tri-render] critical φ* = ${phase.toFixed(10)} (1213 parabolic)`);
} else if (flagVal('--order')) {
  const n = parseInt(flagVal('--order')!, 10);
  const r = findEllipticPhase(orders, n);
  if (r === null) {
    console.error(`[su21-tri-render] --order ${n}: unreachable (splitting 2π/n not attained past φ*)`);
    process.exit(1);
  }
  phase = r.phase;
  console.log(`[su21-tri-render] φ = ${phase.toFixed(10)} — 1213 elliptic, verified order ${r.order ?? 'INFINITE (!)'}`);
}

const EMBEDDING: EmbeddingName =
  flagVal('--embedding') === 'heisenberg' ? 'heisenberg' : 'sphere-stereo';
const fixed = (name: EmbeddingName) =>
  name === 'heisenberg' ? heisenbergEmbedding : stereographicEmbedding;

interface TriConfig { orders: TriangleOrders; phase: number; }
const CONFIG: TriConfig = { orders, phase };

await runRender<TriConfig>({
  family: 'su21-tri', defaultExampleId: triSlug(orders, phase), defaultDepth: 15,
  resolveExample: () => CONFIG,
  exampleId: (c) => triSlug(c.orders, c.phase),
  banner: (c) => {
    const cls = classifyElement(wordProduct(triangleGroupReflections(c.orders, c.phase), WORD_1213));
    return `(${c.orders}) triangle group, φ = ${c.phase.toFixed(6)}  [1213: ${cls.type}, f = ${cls.f.toExponential(2)}]`;
  },
  makeAction: (c) => triangleGroupAction(c.orders, c.phase),
  findSeed: (action) => {
    const s = seedTriangleGroup(action);
    return { basepoint: s.basepoint, note: `γ = ${s.name}, |λ_max| ≈ ${s.lambdaMax.toFixed(3)}` };
  },
  paletteForScheme,
  variant: (_c, preset) => (preset as unknown as TriViewPreset | null)?.embedding ?? EMBEDDING,
  fitEmbedding: () => fixed(EMBEDDING),
  presetEmbedding: (preset) => fixed((preset as unknown as TriViewPreset).embedding),
  extraValueFlags: ['--n', '--phase', '--order', '--embedding'],
});
