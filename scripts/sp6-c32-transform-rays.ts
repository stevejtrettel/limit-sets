/**
 * sp6-c32-transform-rays.ts
 *
 * Take the 254 extremal rays of the C-32 ping-pong cone K (in the paper's
 * u-basis, demos/sp6-c32/c32-extremal-rays.json), apply the signed cyclic
 * shift S, then the inverse transvection T⁻¹, and write the resulting vectors
 * to a CSV — one ray per row, six comma-separated integer coordinates.
 *
 * The map applied to each ray r (as a column vector) is
 *
 *     r  ↦  T⁻¹ · (S · r)          (S first, then T⁻¹)
 *
 * S and T⁻¹ are the u-basis matrices from the "Thinness of C-32" note; they are
 * defined inline below (and match S_U / T_INV_U in demos/sp6-c32/cone.ts and
 * the companion python verifier in demos/sp6-c32/background/).
 *
 *   node scripts/sp6-c32-transform-rays.ts [outfile.csv]
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const RAYS_JSON = resolve(REPO, 'demos/sp6-c32/c32-extremal-rays.json');

// Signed cyclic shift S in the u-basis: S e_i = -e_{i+1}, S e_5 = e_0,
// S⁶ = -I (projectively order 6). Row-major.
const S: readonly (readonly number[])[] = [
  [ 0,  0,  0,  0,  0,  1],
  [-1,  0,  0,  0,  0,  0],
  [ 0, -1,  0,  0,  0,  0],
  [ 0,  0, -1,  0,  0,  0],
  [ 0,  0,  0, -1,  0,  0],
  [ 0,  0,  0,  0, -1,  0],
];

// Inverse transvection T⁻¹ in the u-basis: a row transvection on coordinate 0,
//   T⁻¹y = (y₀ − 5y₁ − 11y₂ − 14y₃ − 11y₄ − 5y₅, y₁, …, y₅).
const T_INV: readonly (readonly number[])[] = [
  [1, -5, -11, -14, -11, -5],
  [0,  1,   0,   0,   0,   0],
  [0,  0,   1,   0,   0,   0],
  [0,  0,   0,   1,   0,   0],
  [0,  0,   0,   0,   1,   0],
  [0,  0,   0,   0,   0,   1],
];

// Left-multiply a column vector by a row-major matrix: out[i] = Σ_j M[i][j] v[j].
function matVec(M: readonly (readonly number[])[], v: readonly number[]): number[] {
  return M.map((row) => row.reduce((acc, m, j) => acc + m * v[j], 0));
}

const { rays } = JSON.parse(readFileSync(RAYS_JSON, 'utf8')) as {
  rays: number[][];
};

const transformed = rays.map((r) => matVec(T_INV, matVec(S, r)));

const csv = transformed.map((v) => v.join(',')).join('\n') + '\n';
const outArg = process.argv[2];
const outPath = outArg
  ? resolve(process.cwd(), outArg)
  : resolve(REPO, 'demos/sp6-c32/c32-rays-Tinv-S.csv');

writeFileSync(outPath, csv);
console.log(`Wrote ${transformed.length} transformed rays (T⁻¹·S·r) to ${outPath}`);
