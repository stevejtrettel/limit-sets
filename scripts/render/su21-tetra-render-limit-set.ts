/**
 * Offline density render of an ideal-tetrahedron (or quadrilateral) limit set
 * on ∂CH² — a thin plugin over scripts/renderDriver.ts.
 *
 * The configuration is CONTINUOUS (moduli, not a catalog id), so this script
 * pre-reads its own view preset (outputs/presets/su21-tetra-view-preset.json,
 * written by the demo's save button) for { moduli, generators }; the driver
 * then reuses the same file for camera/viewport/colorScheme. Without a preset
 * (or with --no-preset), the moduli come from flags:
 *
 *   node scripts/render/su21-tetra-render-limit-set.ts --depth 10 \
 *        --A 0.6 --zx 0.9 --zy 0.35 --v 0.8 [--gens quad] [--embedding heisenberg]
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runRender } from './renderDriver.ts';
import { seedCH2 } from '../../src/examples/complex-hyperbolic/recipe.ts';
import {
  TETRA_EDGE_LABELS, QUAD_SIDE_LABELS,
  tetrahedronFromModuli, tetrahedronAction, quadrilateralAction,
} from '../../src/examples/complex-hyperbolic/tetrahedron.ts';
import { stereographicEmbedding, heisenbergEmbedding } from '../../src/examples/complex-hyperbolic/embedding.ts';
import { tetraPaletteForScheme } from '../../src/examples/complex-hyperbolic/palette.ts';
import {
  moduliSlug, type TetraModuli, type GeneratorSet, type EmbeddingName, type TetraViewPreset,
} from '../../src/examples/complex-hyperbolic/tetraViewPreset.ts';

const flagVal = (n: string): string | null => {
  const i = process.argv.indexOf(n);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : null;
};
const numFlag = (n: string, dflt: number): number => {
  const v = flagVal(n);
  return v === null ? dflt : parseFloat(v);
};

// Pre-read the preset for moduli/generators (the driver re-reads it for the
// camera). CLI flags win only in --no-preset / no-file mode.
const PRESET_PATH = fileURLToPath(new URL('../../outputs/presets/su21-tetra-view-preset.json', import.meta.url));
let moduli: TetraModuli = { A: numFlag('--A', 0.6), zx: numFlag('--zx', 0.9), zy: numFlag('--zy', 0.35), v: numFlag('--v', 0.8) };
let gens: GeneratorSet = flagVal('--gens') === 'quad' ? 'quad' : 'tetra';
if (!process.argv.includes('--no-preset') && existsSync(PRESET_PATH)) {
  try {
    const p = JSON.parse(readFileSync(PRESET_PATH, 'utf8')) as TetraViewPreset;
    if (p.moduli) { moduli = p.moduli; gens = p.generators ?? 'tetra'; }
  } catch { /* fall through to flags */ }
}

const EMBEDDING: EmbeddingName =
  flagVal('--embedding') === 'heisenberg' ? 'heisenberg' : 'sphere-stereo';
const fixed = (name: EmbeddingName) =>
  name === 'heisenberg' ? heisenbergEmbedding : stereographicEmbedding;

interface TetraConfig { moduli: TetraModuli; gens: GeneratorSet; }
const CONFIG: TetraConfig = { moduli, gens };

await runRender<TetraConfig>({
  family: 'su21-tetra', defaultExampleId: moduliSlug(moduli, gens), defaultDepth: 9,
  resolveExample: () => CONFIG,   // configuration is continuous; the id is a slug
  exampleId: (c) => moduliSlug(c.moduli, c.gens),
  banner: (c) => `ideal ${c.gens === 'quad' ? 'quadrilateral' : 'tetrahedron'}  ` +
    `A=${c.moduli.A}  ζ=(${c.moduli.zx}, ${c.moduli.zy})  v=${c.moduli.v}`,
  makeAction: (c) => {
    const pts = tetrahedronFromModuli(c.moduli.A, [c.moduli.zx, c.moduli.zy], c.moduli.v);
    return c.gens === 'quad' ? quadrilateralAction(pts) : tetrahedronAction(pts);
  },
  findSeed: (action, c) => {
    const s = seedCH2(action, c.gens === 'quad' ? QUAD_SIDE_LABELS : TETRA_EDGE_LABELS);
    return { basepoint: s.basepoint, note: `γ = ${s.name}, |λ_max| ≈ ${s.lambdaMax.toFixed(3)}` };
  },
  paletteForScheme: tetraPaletteForScheme,
  variant: (_c, preset) => (preset as unknown as TetraViewPreset | null)?.embedding ?? EMBEDDING,
  fitEmbedding: () => fixed(EMBEDDING),
  presetEmbedding: (preset) => fixed((preset as unknown as TetraViewPreset).embedding),
  extraValueFlags: ['--A', '--zx', '--zy', '--v', '--gens', '--embedding'],
});
