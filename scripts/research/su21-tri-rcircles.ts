/**
 * EXPERIMENT: hunt for genuine R-circles inside (p,q,r) triangle-group limit
 * sets, subgroup-first (three points with A = 0 do NOT certify a circle —
 * containment must be earned).
 *
 *   node scripts/research/su21-tri-rcircles.ts [--n 4,4,4] [--phase x | --critical | --order n]
 *        [--words L] [--eps e]
 *
 * Pipeline:
 *   1. all cyclic word classes ≤ L; keep loxodromics; flag REAL-TRACE words
 *      (tr real up to the ω³=1 lift ambiguity — necessary for conjugacy into
 *      SO(2,1), the R-circle-preserving subgroup).
 *   2. pairs of real-trace words whose mixed traces (gh, gh⁻¹, [g,h]) are
 *      also real → candidate R-Fuchsian pair; its 3 fixed points pin a
 *      unique R-circle (constructed exactly via Gram normalization; the
 *      Cartan invariant of the triple ≈ 0 is checked, not assumed).
 *   3. dedupe circles by the antiholomorphic involution fingerprint.
 *   4. CONTAINMENT SCORE per circle: fraction of 720 circle samples within
 *      ε of a depth-14 orbit cloud (chordal distance on S³ ⊂ R⁴). This is
 *      the honest test — an accidental circle pokes out of Λ immediately.
 *   5. coverage: fraction of Λ (orbit sample) within ε of the circle union.
 */

import { computeProximalBasepoint, generateOrbit } from '../../src/core/orbit.ts';
import { formatWord } from '../../src/core/seed.ts';
import {
  type CMat, cmatMul, cmatInverse, cmatVec, cmat,
} from '../../src/core/complexMatrix.ts';
import { type CVec3, cvec3, herm, cartanInvariant, nullResidual } from '../../src/examples/complex-hyperbolic/hermitian.ts';
import {
  classifyElement, wordProduct, cyclicWordClasses,
} from '../../src/examples/complex-hyperbolic/diagnostics.ts';
import {
  TRIANGLE_LABELS, triangleGroupReflections, triangleGroupAction,
  findParabolicPhase, findEllipticPhase,
  type TriangleOrders,
} from '../../src/examples/complex-hyperbolic/triangleGroup.ts';

// ─── CLI ────────────────────────────────────────────────────────────────────
const argv = process.argv;
const flagVal = (n: string): string | null => {
  const i = argv.indexOf(n);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null;
};
let orders: TriangleOrders = [4, 4, 4];
if (flagVal('--n')) {
  const p = flagVal('--n')!.split(/[,x-]/).map((s) => parseInt(s, 10));
  orders = p as unknown as TriangleOrders;
}
let phase = flagVal('--phase') ? parseFloat(flagVal('--phase')!) : Math.PI;
if (argv.includes('--critical')) phase = findParabolicPhase(orders)!;
if (flagVal('--order')) phase = findEllipticPhase(orders, parseInt(flagVal('--order')!, 10))!.phase;
const MAXLEN = flagVal('--words') ? parseInt(flagVal('--words')!, 10) : 8;
const EPS = flagVal('--eps') ? parseFloat(flagVal('--eps')!) : 0.02;
const CLOUD_DEPTH = flagVal('--depth') ? parseInt(flagVal('--depth')!, 10) : 14;

console.log(`(${orders}) triangle group, φ = ${phase.toFixed(8)}, words ≤ ${MAXLEN}, ε = ${EPS}\n`);
const refl = triangleGroupReflections(orders, phase);
const action = triangleGroupAction(orders, phase);

// ─── Small helpers ──────────────────────────────────────────────────────────
const conjCMat = (M: CMat): CMat => {
  const R = Float64Array.from(M);
  for (let i = 1; i < R.length; i += 2) R[i] = -R[i];
  return R;
};
const trOf = (M: CMat): [number, number] => {
  let re = 0, im = 0;
  for (let k = 0; k < 3; k++) { re += M[2 * (3 * k + k)]; im += M[2 * (3 * k + k) + 1]; }
  return [re, im];
};
/** det-fixed representative (odd words have det −1). */
const detFix = (M: CMat, len: number): CMat => {
  if (len % 2 === 0) return M;
  const R = Float64Array.from(M);
  for (let i = 0; i < R.length; i++) R[i] = -R[i];
  return R;
};
/** Is tr(M) real up to the ω = e^{2πi/3} lift ambiguity? Returns residual. */
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
/** Chordal S³ chart point (x₁,y₁,x₂,y₂) from a C³ state. */
function chartPoint(v: Float64Array, out: Float64Array, o: number): void {
  const d = v[4] * v[4] + v[5] * v[5];
  const x1 = (v[0] * v[4] + v[1] * v[5]) / d, y1 = (v[1] * v[4] - v[0] * v[5]) / d;
  const x2 = (v[2] * v[4] + v[3] * v[5]) / d, y2 = (v[3] * v[4] - v[2] * v[5]) / d;
  const r = 1 / Math.sqrt(x1 * x1 + y1 * y1 + x2 * x2 + y2 * y2);
  out[o] = x1 * r; out[o + 1] = y1 * r; out[o + 2] = x2 * r; out[o + 3] = y2 * r;
}

// ─── 1. Words: loxodromic + real-trace flags ───────────────────────────────
interface WordInfo {
  word: number[];
  M: CMat;          // det-fixed
  lox: boolean;
  realTrace: boolean;
  fixP?: Float64Array;  // attracting fixed point (C³ state)
  fixM?: Float64Array;  // repelling (attracting of inverse = reversed word)
}
const words: WordInfo[] = [];
for (const w of cyclicWordClasses(3, MAXLEN)) {
  const M = detFix(wordProduct(refl, w), w.length);
  const cls = classifyElement(M);
  const lox = cls.type === 'loxodromic';
  const rt = lox && realTraceResidual(M) < 1e-7;
  words.push({ word: w, M, lox, realTrace: rt });
}
const loxWords = words.filter((w) => w.lox);
const realWords = words.filter((w) => w.realTrace);
console.log(`word classes ≤ ${MAXLEN}: ${words.length}  loxodromic: ${loxWords.length}  REAL-TRACE loxodromic: ${realWords.length}`);

// Fixed points for real-trace words (exact Λ points).
for (const wi of realWords) {
  wi.fixP = computeProximalBasepoint(action, wi.word, 800).basepoint;
  wi.fixM = computeProximalBasepoint(action, [...wi.word].reverse(), 800).basepoint;
}

// ─── 2+3. Real pairs → circles → dedupe ────────────────────────────────────
const STD_E: CMat = cmat([   // columns = standard real triple (1,0,1),(−1,0,1),(0,1,1)
  [[1, 0], [-1, 0], [0, 0]],
  [[0, 0], [0, 0], [1, 0]],
  [[1, 0], [1, 0], [1, 0]],
]);
const STD_GRAM = [-2, -1, -1];  // ⟨e₁,e₂⟩, ⟨e₂,e₃⟩, ⟨e₃,e₁⟩

/** Exact R-circle through an A≈0 null triple: returns M ∈ U(2,1) with
 *  circle(t) = M·(cos t, sin t, 1), or null if the triple isn't circle-compatible. */
function circleThrough(p1: CVec3, p2: CVec3, p3: CVec3): CMat | null {
  const A = cartanInvariant(p1, p2, p3);
  if (Math.abs(A) > 1e-5) return null;
  const g = [herm(p1, p2), herm(p2, p3), herm(p3, p1)];
  // Solve sᵢs̄ⱼ·gᵢⱼ = STD_GRAMᵢⱼ (log-linear in |sᵢ|, args from the phase chain).
  const w = g.map((gij, k) => {
    const t = STD_GRAM[k];
    const d = gij[0] * gij[0] + gij[1] * gij[1];
    return [t * gij[0] / d, -t * gij[1] / d];   // w_k = target / g_k
  });
  const L = w.map(([re, im]) => Math.log(Math.hypot(re, im)));
  const a1 = (L[0] - L[1] + L[2]) / 2, a2 = L[0] - a1, a3 = L[2] - a1;
  const th1 = 0;
  const th2 = th1 - Math.atan2(w[0][1], w[0][0]);
  const th3 = th2 - Math.atan2(w[1][1], w[1][0]);
  const s = [
    [Math.exp(a1) * Math.cos(th1), Math.exp(a1) * Math.sin(th1)],
    [Math.exp(a2) * Math.cos(th2), Math.exp(a2) * Math.sin(th2)],
    [Math.exp(a3) * Math.cos(th3), Math.exp(a3) * Math.sin(th3)],
  ];
  // Q columns = sᵢ·pᵢ
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

/** Fingerprint of the circle's R-plane: N = M·conj(M)⁻¹ up to scalar. */
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

interface Circle { M: CMat; key: string; from: string; pairs: number; }
const circles = new Map<string, Circle>();
let nPairs = 0, nRealPairs = 0;

const cap = Math.min(realWords.length, 120);
for (let i = 0; i < cap; i++) {
  for (let j = i + 1; j < cap; j++) {
    nPairs++;
    const G = realWords[i].M, H = realWords[j].M;
    const Hi = cmatInverse(H);
    const comm = cmatMul(cmatMul(G, H), cmatMul(cmatInverse(G), Hi));
    if (realTraceResidual(cmatMul(G, H)) > 1e-6) continue;
    if (realTraceResidual(cmatMul(G, Hi)) > 1e-6) continue;
    if (realTraceResidual(comm) > 1e-6) continue;
    nRealPairs++;
    const p1 = realWords[i].fixP!, p2 = realWords[i].fixM!, p3 = realWords[j].fixP!;
    // degenerate pair (shared axis): p3 too close to p1 or p2 in the chart
    const c = new Float64Array(12);
    chartPoint(p1, c, 0); chartPoint(p2, c, 4); chartPoint(p3, c, 8);
    const d13 = Math.hypot(c[0] - c[8], c[1] - c[9], c[2] - c[10], c[3] - c[11]);
    const d23 = Math.hypot(c[4] - c[8], c[5] - c[9], c[6] - c[10], c[7] - c[11]);
    if (d13 < 1e-4 || d23 < 1e-4) continue;
    const M = circleThrough(p1, p2, p3);
    if (M === null) continue;
    const key = circleKey(M);
    const prev = circles.get(key);
    if (prev) { prev.pairs++; continue; }
    circles.set(key, {
      M, key, pairs: 1,
      from: `${formatWord(realWords[i].word, TRIANGLE_LABELS)} & ${formatWord(realWords[j].word, TRIANGLE_LABELS)}`,
    });
  }
}
console.log(`pairs tested: ${nPairs}  all-real-trace pairs: ${nRealPairs}  DISTINCT circles: ${circles.size}\n`);

// ─── 4. Containment scores against the orbit cloud ─────────────────────────
const seedW = realWords[0] ?? loxWords[0];
const seedPt = seedW.fixP ?? computeProximalBasepoint(action, seedW.word, 800).basepoint;
const orbit = generateOrbit(action, seedPt, CLOUD_DEPTH);
const cloud = new Float64Array(orbit.count * 4);
for (let i = 0; i < orbit.count; i++) chartPoint(orbit.vecs.subarray(i * 6, i * 6 + 6), cloud, i * 4);
console.log(`orbit cloud: ${orbit.count.toLocaleString()} points (depth ${CLOUD_DEPTH})`);

const NSAMP = 720;
function containment(M: CMat): { frac: number; maxGap: number } {
  let inside = 0, maxGap = 0;
  const v = new Float64Array(6), c = new Float64Array(4);
  for (let k = 0; k < NSAMP; k++) {
    const t = (2 * Math.PI * k) / NSAMP;
    const x = Float64Array.from([Math.cos(t), 0, Math.sin(t), 0, 1, 0]);
    v.set(cmatVec(M, x));
    if (nullResidual(v) > 1e-6) return { frac: 0, maxGap: Infinity };
    chartPoint(v, c, 0);
    let best = Infinity;
    for (let i = 0; i < cloud.length; i += 4) {
      const d0 = c[0] - cloud[i], d1 = c[1] - cloud[i + 1], d2 = c[2] - cloud[i + 2], d3 = c[3] - cloud[i + 3];
      const d = d0 * d0 + d1 * d1 + d2 * d2 + d3 * d3;
      if (d < best) best = d;
    }
    best = Math.sqrt(best);
    if (best < EPS) inside++;
    maxGap = Math.max(maxGap, best);
  }
  return { frac: inside / NSAMP, maxGap };
}

// ─── Stabilizer density: the certificate-grade test ─────────────────────────
// Words γ preserving the circle's R-plane restrict to real Möbius maps of the
// circle; their fixed points are Λ-points ON the circle. Dense fixed-point
// angles ⟹ the full circle lies in Λ (independent of cloud depth).
function stabilizerAnalysis(M: CMat): { nStab: number; nAngles: number; maxGapDeg: number; reals: number[][] } {
  const Minv = cmatInverse(M);
  const angles: number[] = [];
  const reals: number[][] = [];
  let nStab = 0;
  for (const wi of words) {
    if (!wi.lox) continue;
    const R = cmatMul(Minv, cmatMul(wi.M, M));
    // real up to a global phase? take phase from the largest entry
    let bi = 0, bm = 0;
    for (let i = 0; i < 18; i += 2) {
      const m = Math.hypot(R[i], R[i + 1]);
      if (m > bm) { bm = m; bi = i; }
    }
    const cr = R[bi] / bm, ci = -R[bi + 1] / bm;
    let imResid = 0;
    const Rr: number[] = [];
    for (let i = 0; i < 18; i += 2) {
      Rr.push(R[i] * cr - R[i + 1] * ci);
      imResid = Math.max(imResid, Math.abs(R[i] * ci + R[i + 1] * cr));
    }
    if (imResid > 1e-6 * (1 + bm)) continue;
    nStab++;
    reals.push([0, 1, 2, 3, 4, 5, 6, 7, 8].map((k) => Rr[k]));
    // attracting fixed point of the real 3×3 on the standard circle
    let v = [1, 0.7, 1.3];
    for (let it = 0; it < 300; it++) {
      const nv = [0, 1, 2].map((r) => Rr[r * 3] * v[0] + Rr[r * 3 + 1] * v[1] + Rr[r * 3 + 2] * v[2]);
      const n = Math.hypot(...nv);
      v = nv.map((x) => x / n);
    }
    if (Math.abs(v[2]) > 1e-9) angles.push(Math.atan2(v[1] / v[2], v[0] / v[2]));
  }
  const uniq = [...new Set(angles.map((a) => a.toFixed(6)))].map(Number).sort((a, b) => a - b);
  let maxGap = uniq.length > 1 ? 2 * Math.PI + uniq[0] - uniq[uniq.length - 1] : 2 * Math.PI;
  for (let i = 1; i < uniq.length; i++) maxGap = Math.max(maxGap, uniq[i] - uniq[i - 1]);
  return { nStab, nAngles: uniq.length, maxGapDeg: (maxGap * 180) / Math.PI, reals };
}

/**
 * THE decisive test: iterate the restricted Fuchsian group ⟨stabilizer
 * restrictions⟩ ⊂ SO(2,1) on the circle itself (random products, real 3×3 —
 * essentially free) and measure the largest angular gap of the resulting
 * limit-point sample. First kind (gap → 0): the FULL circle is in Λ.
 * Second kind (gap persists): only a Cantor subset is certified.
 */
function restrictedDensity(reals: number[][], nSamples = 30000, wordLen = 24): number {
  if (reals.length < 2) return 360;
  const gens: number[][] = [];
  for (const R of reals) {
    gens.push(R);
    // inverse via adjugate/det for 3×3
    const [a, b, c, d, e, f, g, h, i] = R;
    const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
    gens.push([
      (e * i - f * h) / det, (c * h - b * i) / det, (b * f - c * e) / det,
      (f * g - d * i) / det, (a * i - c * g) / det, (c * d - a * f) / det,
      (d * h - e * g) / det, (b * g - a * h) / det, (a * e - b * d) / det,
    ]);
  }
  const angles: number[] = [];
  for (let s = 0; s < nSamples; s++) {
    let v = [1, 0, 1];  // a point on the standard R-circle
    for (let k = 0; k < wordLen; k++) {
      const R = gens[(Math.random() * gens.length) | 0];
      v = [
        R[0] * v[0] + R[1] * v[1] + R[2] * v[2],
        R[3] * v[0] + R[4] * v[1] + R[5] * v[2],
        R[6] * v[0] + R[7] * v[1] + R[8] * v[2],
      ];
      const n = Math.hypot(...v);
      v = [v[0] / n, v[1] / n, v[2] / n];
    }
    if (Math.abs(v[2]) > 1e-12) angles.push(Math.atan2(v[1] / v[2], v[0] / v[2]));
  }
  angles.sort((x, y) => x - y);
  if (angles.length < 100) return 360;
  let maxGap = 2 * Math.PI + angles[0] - angles[angles.length - 1];
  for (let k = 1; k < angles.length; k++) maxGap = Math.max(maxGap, angles[k] - angles[k - 1]);
  return (maxGap * 180) / Math.PI;
}

const scored = [...circles.values()].map((c) => ({ c, s: containment(c.M) }));
scored.sort((a, b) => b.s.frac - a.s.frac);
const verdicts = scored.map(({ c, s }) => {
  const st = stabilizerAnalysis(c.M);
  const gapDeg = restrictedDensity(st.reals);
  const isGenuine = gapDeg < 2 || s.frac > 0.98;
  return { c, s, st, gapDeg, isGenuine };
});
const genuine = verdicts.filter((v) => v.isGenuine).length;
for (const v of verdicts.slice(0, 25)) {
  const mark = v.isGenuine ? '✓ GENUINE' : v.gapDeg < 360 ? '~ Cantor?' : '✗ accidental';
  console.log(
    `  ${mark}  cloud ${(v.s.frac * 100).toFixed(1)}%  ` +
    `stab: ${v.st.nStab} words  restricted-orbit maxGap: ${v.gapDeg.toFixed(2)}°  ` +
    `(${v.c.pairs} pairs)  from ${v.c.from}`,
  );
}
if (verdicts.length > 25) console.log(`  … and ${verdicts.length - 25} more`);

// ─── 5. Coverage of Λ by the circle family ─────────────────────────────────
// Union coverage over every certified-pair circle (not just strict-genuine):
// this is the "Λ = closure of the circle family" measurement itself.
const good = verdicts.filter((v) => v.s.frac > 0.3);
if (good.length > 0) {
  const samples = new Float64Array(good.length * NSAMP * 4);
  let si = 0;
  const v = new Float64Array(6);
  for (const { c } of good) {
    for (let k = 0; k < NSAMP; k++) {
      const t = (2 * Math.PI * k) / NSAMP;
      v.set(cmatVec(c.M, Float64Array.from([Math.cos(t), 0, Math.sin(t), 0, 1, 0])));
      chartPoint(v, samples, si); si += 4;
    }
  }
  let covered = 0;
  const NTEST = 3000, stride = Math.max(1, Math.floor(orbit.count / NTEST));
  let tested = 0;
  for (let i = 0; i < orbit.count; i += stride) {
    tested++;
    let best = Infinity;
    for (let jj = 0; jj < samples.length; jj += 4) {
      const d0 = cloud[i * 4] - samples[jj], d1 = cloud[i * 4 + 1] - samples[jj + 1];
      const d2 = cloud[i * 4 + 2] - samples[jj + 2], d3 = cloud[i * 4 + 3] - samples[jj + 3];
      const d = d0 * d0 + d1 * d1 + d2 * d2 + d3 * d3;
      if (d < best) best = d;
    }
    if (Math.sqrt(best) < EPS) covered++;
  }
  console.log(`\nSUMMARY: ${genuine} genuine circles (of ${circles.size} candidates); ` +
    `Λ coverage by their union: ${(100 * covered / tested).toFixed(1)}% (ε = ${EPS})`);
} else {
  console.log(`\nSUMMARY: no genuine circles found (of ${circles.size} candidates)`);
}
