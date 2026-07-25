/**
 * TEST PICTURE: certified R-circles drawn over the (p,q,r) triangle-group
 * limit set. Limit set = dark points; each certified circle = its own color.
 *
 *   node scripts/research/su21-tri-rcircle-picture.ts [--critical | --order n | --phase x]
 *        [--n 4,4,4] [--words L] [--depth D] [--top K] [--embedding heisenberg]
 *        [--max-dim W]
 *
 * Projection: SceneEmbedding → orthographic (drop the third coordinate),
 * bbox fit on the limit points (1–99 percentile). Output:
 * outputs/su21-tri/rcircles-<slug>.png
 */

import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { writePng } from '../../src/render/png.ts';
import { computeProximalBasepoint, generateOrbit } from '../../src/core/orbit.ts';
import {
  type CMat, cmatMul, cmatInverse, cmatVec, cmat,
} from '../../src/core/complexMatrix.ts';
import { type CVec3, herm, cartanInvariant } from '../../src/examples/complex-hyperbolic/hermitian.ts';
import {
  classifyElement, wordProduct, cyclicWordClasses,
} from '../../src/examples/complex-hyperbolic/diagnostics.ts';
import { stereographicEmbedding, heisenbergEmbedding } from '../../src/examples/complex-hyperbolic/embedding.ts';
import {
  triangleGroupReflections, triangleGroupAction,
  findParabolicPhase, findEllipticPhase,
  type TriangleOrders,
} from '../../src/examples/complex-hyperbolic/triangleGroup.ts';
import { triSlug } from '../../src/examples/complex-hyperbolic/triViewPreset.ts';

// ─── CLI ────────────────────────────────────────────────────────────────────
const argv = process.argv;
const flagVal = (n: string): string | null => {
  const i = argv.indexOf(n);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null;
};
let orders: TriangleOrders = [4, 4, 4];
if (flagVal('--n')) orders = flagVal('--n')!.split(/[,x-]/).map((s) => parseInt(s, 10)) as unknown as TriangleOrders;
let phase = flagVal('--phase') ? parseFloat(flagVal('--phase')!) : Math.PI;
if (argv.includes('--critical')) phase = findParabolicPhase(orders)!;
if (flagVal('--order')) phase = findEllipticPhase(orders, parseInt(flagVal('--order')!, 10))!.phase;
const MAXLEN = flagVal('--words') ? parseInt(flagVal('--words')!, 10) : 10;
const DEPTH = flagVal('--depth') ? parseInt(flagVal('--depth')!, 10) : 15;
const TOP = flagVal('--top') ? parseInt(flagVal('--top')!, 10) : 12;
const DIM = flagVal('--max-dim') ? parseInt(flagVal('--max-dim')!, 10) : 2400;
const EMB = flagVal('--embedding') === 'heisenberg' ? heisenbergEmbedding : stereographicEmbedding;

console.log(`(${orders}) φ = ${phase.toFixed(8)}  words ≤ ${MAXLEN}  depth ${DEPTH}  view ${EMB.label}`);
const refl = triangleGroupReflections(orders, phase);
const action = triangleGroupAction(orders, phase);

// ─── Circle pipeline (as in su21-tri-rcircles.ts) ───────────────────────────
const detFix = (M: CMat, len: number): CMat => {
  if (len % 2 === 0) return M;
  const R = Float64Array.from(M); for (let i = 0; i < R.length; i++) R[i] = -R[i]; return R;
};
const trOf = (M: CMat): [number, number] => {
  let re = 0, im = 0;
  for (let k = 0; k < 3; k++) { re += M[2 * (3 * k + k)]; im += M[2 * (3 * k + k) + 1]; }
  return [re, im];
};
function realTraceResidual(M: CMat): number {
  const [re, im] = trOf(M);
  const mag = 1 + Math.hypot(re, im);
  let best = Infinity;
  for (let k = 0; k < 3; k++) {
    const th = (2 * Math.PI * k) / 3;
    best = Math.min(best, Math.abs(-re * Math.sin(th) + im * Math.cos(th)));
  }
  return best / mag;
}
const conjCMat = (M: CMat): CMat => {
  const R = Float64Array.from(M);
  for (let i = 1; i < R.length; i += 2) R[i] = -R[i];
  return R;
};
const STD_E: CMat = cmat([
  [[1, 0], [-1, 0], [0, 0]],
  [[0, 0], [0, 0], [1, 0]],
  [[1, 0], [1, 0], [1, 0]],
]);
const STD_GRAM = [-2, -1, -1];
function circleThrough(p1: CVec3, p2: CVec3, p3: CVec3): CMat | null {
  if (Math.abs(cartanInvariant(p1, p2, p3)) > 1e-5) return null;
  const g = [herm(p1, p2), herm(p2, p3), herm(p3, p1)];
  const w = g.map((gij, k) => {
    const d = gij[0] * gij[0] + gij[1] * gij[1];
    return [STD_GRAM[k] * gij[0] / d, -STD_GRAM[k] * gij[1] / d];
  });
  const L = w.map(([re, im]) => Math.log(Math.hypot(re, im)));
  const a1 = (L[0] - L[1] + L[2]) / 2, a2 = L[0] - a1, a3 = L[2] - a1;
  const th2 = -Math.atan2(w[0][1], w[0][0]);
  const th3 = th2 - Math.atan2(w[1][1], w[1][0]);
  const s = [
    [Math.exp(a1), 0],
    [Math.exp(a2) * Math.cos(th2), Math.exp(a2) * Math.sin(th2)],
    [Math.exp(a3) * Math.cos(th3), Math.exp(a3) * Math.sin(th3)],
  ];
  const Q = new Float64Array(18);
  [p1, p2, p3].forEach((p, i) => {
    const [sr, si] = s[i];
    for (let r = 0; r < 3; r++) {
      Q[2 * (r * 3 + i)]     = sr * p[2 * r] - si * p[2 * r + 1];
      Q[2 * (r * 3 + i) + 1] = sr * p[2 * r + 1] + si * p[2 * r];
    }
  });
  return cmatMul(Q, cmatInverse(STD_E));
}
function circleKey(M: CMat): string {
  const N = cmatMul(M, cmatInverse(conjCMat(M)));
  let bi = 0, bm = 0;
  for (let i = 0; i < 18; i += 2) {
    const m = Math.hypot(N[i], N[i + 1]);
    if (m > bm + 1e-12) { bm = m; bi = i; }
  }
  const dr = N[bi] / (bm * bm), di = -N[bi + 1] / (bm * bm);
  const parts: string[] = [];
  for (let i = 0; i < 18; i += 2) {
    parts.push((N[i] * dr - N[i + 1] * di).toFixed(4), (N[i] * di + N[i + 1] * dr).toFixed(4));
  }
  return parts.join(',').replace(/-0\.0000/g, '0.0000');
}

interface RW { word: number[]; M: CMat; fixP: Float64Array; fixM: Float64Array; }
const realWords: RW[] = [];
for (const w of cyclicWordClasses(3, MAXLEN)) {
  const M = detFix(wordProduct(refl, w), w.length);
  if (classifyElement(M).type !== 'loxodromic') continue;
  if (realTraceResidual(M) > 1e-7) continue;
  realWords.push({
    word: w, M,
    fixP: computeProximalBasepoint(action, w, 800).basepoint,
    fixM: computeProximalBasepoint(action, [...w].reverse(), 800).basepoint,
  });
}
const circles = new Map<string, { M: CMat; pairs: number }>();
const cap = Math.min(realWords.length, 120);
for (let i = 0; i < cap; i++) {
  for (let j = i + 1; j < cap; j++) {
    const G = realWords[i].M, H = realWords[j].M;
    const Hi = cmatInverse(H);
    if (realTraceResidual(cmatMul(G, H)) > 1e-6) continue;
    if (realTraceResidual(cmatMul(G, Hi)) > 1e-6) continue;
    if (realTraceResidual(cmatMul(cmatMul(G, H), cmatMul(cmatInverse(G), Hi))) > 1e-6) continue;
    const M = circleThrough(realWords[i].fixP, realWords[i].fixM, realWords[j].fixP);
    if (M === null) continue;
    const key = circleKey(M);
    const prev = circles.get(key);
    if (prev) prev.pairs++;
    else circles.set(key, { M, pairs: 1 });
  }
}
const family = [...circles.values()].sort((a, b) => b.pairs - a.pairs).slice(0, TOP);
console.log(`real-trace words: ${realWords.length}  distinct circles: ${circles.size}  drawing top ${family.length}`);

// ─── Membership: which circle (if any) owns each limit point ────────────────
// Distances measured chordally on S³ (the w-chart in R⁴) — projection-proof.
const EPS = flagVal('--eps') ? parseFloat(flagVal('--eps')!) : 0.015;
function chartPoint(v: Float64Array, o: number, out: Float64Array, oo: number): void {
  const d = v[o + 4] * v[o + 4] + v[o + 5] * v[o + 5];
  const x1 = (v[o] * v[o + 4] + v[o + 1] * v[o + 5]) / d, y1 = (v[o + 1] * v[o + 4] - v[o] * v[o + 5]) / d;
  const x2 = (v[o + 2] * v[o + 4] + v[o + 3] * v[o + 5]) / d, y2 = (v[o + 3] * v[o + 4] - v[o + 2] * v[o + 5]) / d;
  const r = 1 / Math.sqrt(x1 * x1 + y1 * y1 + x2 * x2 + y2 * y2);
  out[oo] = x1 * r; out[oo + 1] = y1 * r; out[oo + 2] = x2 * r; out[oo + 3] = y2 * r;
}
const MSAMP = 1440;
const circleSamp = new Float64Array(family.length * MSAMP * 4);
{
  const v = new Float64Array(6);
  family.forEach(({ M }, ci) => {
    for (let k = 0; k < MSAMP; k++) {
      const t = (2 * Math.PI * k) / MSAMP;
      v.set(cmatVec(M, Float64Array.from([Math.cos(t), 0, Math.sin(t), 0, 1, 0])));
      chartPoint(v, 0, circleSamp, (ci * MSAMP + k) * 4);
    }
  });
}

const orbit = generateOrbit(action, realWords[0].fixP, DEPTH);
const pts2: number[] = [];       // x, y, owner (−1 = none)
const eps2 = EPS * EPS;
{
  const out = new Float64Array(3);
  const c = new Float64Array(4);
  let owned = 0;
  for (let i = 0; i < orbit.count; i++) {
    if (!EMB.embed(orbit.vecs, i * 6, out, 0)) continue;
    chartPoint(orbit.vecs, i * 6, c, 0);
    let owner = -1, best = eps2;
    for (let j = 0; j < circleSamp.length; j += 4) {
      const d0 = c[0] - circleSamp[j], d1 = c[1] - circleSamp[j + 1];
      const d2 = c[2] - circleSamp[j + 2], d3 = c[3] - circleSamp[j + 3];
      const d = d0 * d0 + d1 * d1 + d2 * d2 + d3 * d3;
      if (d < best) { best = d; owner = (j >> 2) / MSAMP | 0; }
    }
    if (owner >= 0) owned++;
    pts2.push(out[0], out[1], owner);
  }
  console.log(`membership (ε = ${EPS}): ${owned.toLocaleString()} of ${(pts2.length / 3).toLocaleString()} limit points lie on a drawn circle (${(100 * owned / (pts2.length / 3)).toFixed(1)}%)`);
}
// bbox: 1–99 percentile
const xs = [], ys = [];
for (let i = 0; i < pts2.length; i += 3) { xs.push(pts2[i]); ys.push(pts2[i + 1]); }
xs.sort((a, b) => a - b); ys.sort((a, b) => a - b);
const pct = (arr: number[], p: number): number => arr[Math.floor(p * (arr.length - 1))];
let x0 = pct(xs, 0.01), x1 = pct(xs, 0.99), y0 = pct(ys, 0.01), y1 = pct(ys, 0.99);
const padX = 0.06 * (x1 - x0), padY = 0.06 * (y1 - y0);
x0 -= padX; x1 += padX; y0 -= padY; y1 += padY;
const aspect = (y1 - y0) / (x1 - x0);
const W = aspect > 1 ? Math.round(DIM / aspect) : DIM;
const H = aspect > 1 ? DIM : Math.round(DIM * aspect);
const px = (x: number): number => ((x - x0) / (x1 - x0)) * (W - 1);
const py = (y: number): number => (1 - (y - y0) / (y1 - y0)) * (H - 1);

const rgba = new Uint8Array(W * H * 4).fill(255);
function plot(xp: number, yp: number, r: number, g: number, b: number, rad: number): void {
  const xi = Math.round(xp), yi = Math.round(yp);
  for (let dy = -rad; dy <= rad; dy++) {
    for (let dx = -rad; dx <= rad; dx++) {
      const x = xi + dx, y = yi + dy;
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const o = (y * W + x) * 4;
      rgba[o] = r; rgba[o + 1] = g; rgba[o + 2] = b; rgba[o + 3] = 255;
    }
  }
}
const hueRGB = (h: number): [number, number, number] => {
  const f = (n: number): number => {
    const k = (n + h * 12) % 12;
    return Math.round(255 * (0.45 - 0.35 * Math.max(-1, Math.min(1, Math.min(k - 3, 9 - k)))));
  };
  return [f(0), f(8), f(4)];
};
const hue = (ci: number): [number, number, number] => hueRGB(ci / Math.max(1, family.length));

// 1. unowned limit points: light gray (context)
for (let i = 0; i < pts2.length; i += 3) {
  if (pts2[i + 2] < 0) plot(px(pts2[i]), py(pts2[i + 1]), 185, 185, 185, 0);
}
// 2. the circles as thin curves (their claim)
const NSAMP = 6000;
family.forEach(({ M }, ci) => {
  const [r, g, b] = hue(ci);
  const rl = Math.round(140 + 0.45 * r), gl = Math.round(140 + 0.45 * g), bl = Math.round(140 + 0.45 * b);
  const out = new Float64Array(3);
  const v = new Float64Array(6);
  for (let k = 0; k < NSAMP; k++) {
    const t = (2 * Math.PI * k) / NSAMP;
    v.set(cmatVec(M, Float64Array.from([Math.cos(t), 0, Math.sin(t), 0, 1, 0])));
    if (EMB.embed(v, 0, out, 0)) {
      const xp = px(out[0]), yp = py(out[1]);
      if (xp >= -5 && yp >= -5 && xp < W + 5 && yp < H + 5) plot(xp, yp, rl, gl, bl, 0);
    }
  }
});
// 3. owned limit points ON TOP, saturated in their circle's color (the evidence)
for (let i = 0; i < pts2.length; i += 3) {
  const owner = pts2[i + 2];
  if (owner >= 0) {
    const [r, g, b] = hue(owner);
    plot(px(pts2[i]), py(pts2[i + 1]), r, g, b, 1);
  }
}

const outDir = fileURLToPath(new URL('../../outputs/su21-tri/', import.meta.url));
mkdirSync(outDir, { recursive: true });
const file = `${outDir}rcircles-${triSlug(orders, phase)}-${EMB.label}-top${family.length}.png`;
await writePng(file, W, H, rgba);
console.log(`wrote ${file}  (${W}×${H}, ${(pts2.length / 2).toLocaleString()} limit points, ${family.length} circles)`);
