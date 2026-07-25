/**
 * Gates for the C-32 figure path — the offline convex-body renderer.
 *
 *   node scripts/tests/c32-figure-gates.ts
 *
 * 1. hull3 on known answers: a cube (6 square faces, 12 edges, 8 corners — the
 *    coplanar merge must NOT leave 12 triangles), a cube with face-interior and
 *    interior points, a simplex, and a random cloud checked against brute force.
 * 2. hull3 on the real thing: the C-32 cone's 254 rays through the notebook
 *    chart — every ray inside the hull (zero residual), Euler characteristic 2.
 * 2b. the rosette covector u = (5,11,14,11,5,1): exactly (BigInt) one-signed on
 *    all 6 × 254 rays of the rotations, so all six Sᵏ·K are bounded in one affine
 *    patch — and no coordinate patch manages that.
 * 2c. chart pieces: a domain straddling the hyperplane at infinity splits into
 *    two truncated halves, and each half CONTAINS every visible ray on its side
 *    (the cut loses nothing), and the flat lids the cut leaves are identified
 *    exactly so they can be dropped and the half drawn open.
 * 3. camera: `projectDepth` agrees with `project` where the latter is defined,
 *    orders depth correctly, and `viewFrameAt` recovers an orthonormal frame.
 * 3b. `glassDepth` — the quantity the linework's depth cue is built on: how much
 *    body lies between a stroke and the viewer. Checked on a cube against answers
 *    worked out by hand, then over every C-32 copy × 60 view directions against a
 *    BISECTION on plain point-in-body membership, which shares no code with the
 *    halfspace formula (and is held to ITS own accuracy, tol/(n·v) at the exit
 *    face — the closed form is the accurate one). Also: δ obeys its true Lipschitz
 *    bound 1/min(n·v) along a stroke, which is what limits how fast the weight can
 *    change; and δ=0 recovers the classical rule at surface points.
 * 4. the whole overlay: draw the domain into a buffer and check it inked pixels
 *    of the expected color, inside the body and not outside it.
 */

import { convexHull3, convexHull3Sparse, hullViolation, type Hull3, type Vec3 } from '../../src/core/hull3.ts';
import { makeOrthographicCamera, makePerspectiveCamera, viewFrameAt } from '../../src/core/camera.ts';
import {
  c32Chart, coneBoundedInChart, copyChartPieces, copyCone, copiesFor,
  ROSETTE_SIGNS, ROSETTE_U,
} from '../../src/examples/hypergeometric/c32-domain.ts';
import { c32Cone } from '../../src/examples/hypergeometric/c32-cone.ts';
import { clipBoxFaces, embedRays } from '../../src/core/convexChart.ts';
import { drawConvexBody, glassDepth, DEFAULT_BODY_STYLE } from '../../src/render/convexBody.ts';
import { fillBackground } from '../../src/render/lineRaster.ts';

let failures = 0;
function check(name: string, ok: boolean, detail = ''): void {
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `   ${detail}` : ''}`);
}

// ─── 1. hull3 against known answers ──────────────────────────────────────────

console.log('\nhull3 — known answers');

const CUBE: Vec3[] = [];
for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) CUBE.push([x, y, z]);

{
  const h = convexHull3(CUBE);
  check('cube: 6 faces (coplanar triangles merged)', h.faces.length === 6, `got ${h.faces.length}`);
  check('cube: 12 edges', h.edges.length === 12, `got ${h.edges.length}`);
  check('cube: every face is a quad', h.faces.every((f) => f.loop.length === 4));
  check('cube: all 8 corners on the boundary', h.boundary.size === 8, `got ${h.boundary.size}`);
  check('cube: normals are outward unit vectors',
    h.faces.every((f) => Math.abs(Math.hypot(...f.normal) - 1) < 1e-12 && Math.abs(f.offset - 1) < 1e-12));
  check('cube: zero residual', hullViolation(CUBE, h) < 1e-12);
}

{
  // Degeneracy that the merge has to survive: points sitting ON faces and edges,
  // plus one strictly inside. The hull is unchanged; the extra surface points
  // join `boundary` but must not create spurious faces.
  const pts: Vec3[] = [...CUBE, [0, 0, 1], [0.5, -0.5, 1], [1, 0, 0], [0, 1, 0.5], [0, 0, 0], [0.2, 0.1, -0.3]];
  const h = convexHull3(pts);
  check('cube + coplanar + interior points: still 6 faces', h.faces.length === 6, `got ${h.faces.length}`);
  check('cube + extras: 4 surface points added, 2 interior excluded',
    h.boundary.size === 12, `got ${h.boundary.size}`);
  check('cube + extras: zero residual', hullViolation(pts, h) < 1e-12);
}

{
  const simplex: Vec3[] = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const h = convexHull3(simplex);
  check('simplex: 4 triangular faces', h.faces.length === 4 && h.faces.every((f) => f.loop.length === 3));
  check('simplex: 6 edges', h.edges.length === 6, `got ${h.edges.length}`);
}

{
  const flat: Vec3[] = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [2, 3, 0]];
  check('coplanar cloud is reported degenerate', convexHull3(flat).degenerate);
  check('fewer than 4 points is degenerate', convexHull3([[0, 0, 0], [1, 1, 1]]).degenerate);
}

{
  // Random cloud vs brute force: a triple of points spans a facet iff every
  // other point lies weakly on one side. Comparing the resulting SUPPORT
  // FUNCTION is basis-free — it does not care how faces were merged or ordered.
  let seed = 12345;
  const rnd = (): number => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff * 2 - 1; };
  const cloud: Vec3[] = Array.from({ length: 40 }, () => [rnd(), rnd(), rnd()] as Vec3);
  const h = convexHull3(cloud);
  check('random cloud: zero residual', hullViolation(cloud, h) < 1e-9, `${hullViolation(cloud, h).toExponential(1)}`);

  let maxErr = 0;
  for (let t = 0; t < 200; t++) {
    const d: Vec3 = [rnd(), rnd(), rnd()];
    const l = Math.hypot(...d);
    if (l < 1e-6) continue;
    const u: Vec3 = [d[0] / l, d[1] / l, d[2] / l];
    const direct = Math.max(...cloud.map((p) => p[0] * u[0] + p[1] * u[1] + p[2] * u[2]));
    // Support of the hull: maximum over its own vertices.
    const verts = new Set<number>();
    for (const f of h.faces) for (const i of f.loop) verts.add(i);
    const viaHull = Math.max(...[...verts].map((i) => {
      const p = cloud[i];
      return p[0] * u[0] + p[1] * u[1] + p[2] * u[2];
    }));
    maxErr = Math.max(maxErr, Math.abs(direct - viaHull));
  }
  check('random cloud: support function matches brute force', maxErr < 1e-12, `max err ${maxErr.toExponential(1)}`);
}

// ─── 2. hull3 on the projected C-32 cone ─────────────────────────────────────

console.log('\nhull3 — the C-32 domain through the notebook chart');

const chart = c32Chart();
function projected(g: Parameters<typeof copyCone>[0]): (Vec3 | null)[] {
  const cone = copyCone(g);
  const buf = new Float64Array(6), out = new Float64Array(3);
  return cone.rays.map((r) => {
    for (let j = 0; j < 6; j++) buf[j] = r[j];
    return chart.embed(buf, 0, out, 0) ? ([out[0], out[1], out[2]] as Vec3) : null;
  });
}

let baseHull!: Hull3;
let basePts!: (Vec3 | null)[];
{
  const base = copiesFor('base')[0];
  basePts = projected(base.g);
  const live = basePts.filter((p): p is Vec3 => p !== null);
  check('ℙ(K): all 254 rays land in the chart', live.length === 254, `got ${live.length}`);

  baseHull = convexHull3Sparse(basePts);
  check('ℙ(K): hull is non-degenerate', !baseHull.degenerate);
  const res = hullViolation(live, baseHull);
  check('ℙ(K): zero hull residual', res < 1e-9, `${res.toExponential(1)}`);

  // Euler characteristic of a convex polytope surface: V − E + F = 2.
  const V = new Set<number>();
  for (const f of baseHull.faces) for (const i of f.loop) V.add(i);
  const chi = V.size - baseHull.edges.length + baseHull.faces.length;
  check('ℙ(K): V − E + F = 2', chi === 2,
    `V=${V.size} E=${baseHull.edges.length} F=${baseHull.faces.length} χ=${chi}`);
  check('ℙ(K): every face loop closes with ≥3 vertices', baseHull.faces.every((f) => f.loop.length >= 3));
  check('ℙ(K): silhouette ⊆ all rays', baseHull.boundary.size <= 254 && baseHull.boundary.size >= V.size);
}

{
  // The nested branch images T⁻¹Sᵏ·K all sit inside K (the ping-pong property),
  // so each must hull cleanly in the same chart.
  let bad = 0;
  for (const c of copiesFor('nested')) {
    const pts = projected(c.g);
    const live = pts.filter((p): p is Vec3 => p !== null);
    const h = convexHull3Sparse(pts);
    if (h.degenerate || hullViolation(live, h) > 1e-9) bad++;
  }
  check('nested T⁻¹Sᵏ·K: all 6 hull cleanly', bad === 0, `${bad} bad`);
}

// ─── 2b. the rosette covector ────────────────────────────────────────────────

console.log('\nrosette covector — all six Sᵏ·K bounded in one affine patch');

{
  // The claim is exact and integer: u·y is strictly one-signed, with the
  // alternating sign pattern, over every ray of every rotation. Checked in
  // BigInt so no rounding can hide a ray sitting on the hyperplane.
  const K = c32Cone();
  let violations = 0, worstAbs = Infinity;
  copiesFor('rotated').forEach((c, k) => {
    for (const r of K.rays) {
      let d = 0n;
      for (let i = 0; i < 6; i++) {
        let y = 0n;
        for (let j = 0; j < 6; j++) y += BigInt(Math.round(c.g[i * 6 + j])) * BigInt(r[j]);
        d += BigInt(ROSETTE_U[i]) * y;
      }
      const signed = ROSETTE_SIGNS[k] > 0 ? d : -d;
      if (signed <= 0n) violations++;
      else worstAbs = Math.min(worstAbs, Number(signed));
    }
  });
  check('u = (5,11,14,11,5,1) is strictly one-signed on all 6 × 254 rays (exact)',
    violations === 0, `${violations} violations, min |u·y| = ${worstAbs}`);

  const rose = c32Chart('rosette', 0, [1, 2, 5]);
  const bounded = copiesFor('rotated').filter((c) => coneBoundedInChart(copyCone(c.g), rose)).length;
  check('rosette chart bounds all 6 rotations', bounded === 6, `${bounded}/6`);
  const nested = copiesFor('nested').filter((c) => coneBoundedInChart(copyCone(c.g), rose)).length;
  check('rosette chart also bounds K and all 6 nested images',
    nested === 6 && coneBoundedInChart(copyCone(copiesFor('base')[0].g), rose), `nested ${nested}/6`);

  // Why the rosette system has to exist: no COORDINATE patch does the job.
  let bestCoord = 0;
  for (const sys of ['companion', 'u']) {
    for (let d = 0; d < 6; d++) {
      const ch = c32Chart(sys, d, [(d + 1) % 6, (d + 2) % 6, (d + 3) % 6]);
      bestCoord = Math.max(bestCoord, copiesFor('rotated').filter((c) => coneBoundedInChart(copyCone(c.g), ch)).length);
    }
  }
  check('no coordinate patch bounds all 6 (best is 5)', bestCoord === 5, `best ${bestCoord}/6`);
}

// ─── 2c. splitting a copy that runs through infinity ─────────────────────────

console.log('\nchart pieces — a domain crossing infinity, drawn as two halves');

{
  const EXTENT = 8;
  const bounded = c32Chart();                       // u-basis z₁: K is bounded here
  const crossing = c32Chart('u', 1, [0, 2, 4]);     // u-basis z₂: K straddles infinity
  const base = copiesFor('base')[0];

  const whole = copyChartPieces(base.g, bounded, EXTENT);
  check('bounded chart: one piece, uncut', whole.length === 1 && !whole[0].clipped,
    `${whole.length} piece(s)`);
  check('bounded chart: the piece is the cone itself',
    whole[0]?.rays.length === 254, `${whole[0]?.rays.length} rays`);

  const halves = copyChartPieces(base.g, crossing, EXTENT);
  check('crossing chart: two pieces, both truncated',
    halves.length === 2 && halves.every((p) => p.clipped), `${halves.length} piece(s)`);
  check('crossing chart: one piece per side of the hyperplane',
    new Set(halves.map((p) => p.sign)).size === 2);

  const chartPoint = (r: readonly number[]): Vec3 | null => {
    const buf = new Float64Array(r), out = new Float64Array(3);
    return crossing.embed(buf, 0, out, 0) ? [out[0], out[1], out[2]] : null;
  };
  const dotd = (r: readonly number[]): number => crossing.denom.reduce((s, v, j) => s + v * r[j], 0);

  // Every corner of a truncated half must sit inside the truncation box.
  let outside = 0;
  for (const piece of halves) {
    for (const r of piece.rays) {
      const p = chartPoint(r);
      if (p && Math.max(Math.abs(p[0]), Math.abs(p[1]), Math.abs(p[2])) > EXTENT * (1 + 1e-6)) outside++;
    }
  }
  check('halves stay inside the truncation box', outside === 0, `${outside} corners outside`);

  // Soundness — the real check. Every ray of the ORIGINAL copy that is visible
  // (inside the box, on this side of the hyperplane) must lie in the half that
  // claims it. If the cut lost geometry, this is where it shows.
  let lost = 0, tested = 0;
  const cone = copyCone(base.g);
  for (const piece of halves) {
    const hull = convexHull3Sparse(piece.rays.map(chartPoint));
    if (hull.degenerate) { lost = -1; break; }
    for (const r of cone.rays) {
      const s = dotd(r);
      if (Math.sign(s) !== piece.sign) continue;
      const p = chartPoint(r);
      if (!p || Math.max(Math.abs(p[0]), Math.abs(p[1]), Math.abs(p[2])) > EXTENT * 0.98) continue;
      tested++;
      if (hullViolation([p], hull) > 1e-6) lost++;
    }
  }
  check('each half contains every visible ray on its side',
    lost === 0, `${lost} lost of ${tested} tested`);

  // The lids the cut leaves behind must be identifiable, so they can be dropped
  // and the half drawn OPEN where it was truncated. A lid is a hull face on a
  // box plane π_a = ±M; a genuine face of the domain that happens to be
  // axis-aligned (K has one, at offset −1) must NOT be mistaken for one.
  const axes3 = c32Chart('u', 1, [0, 2, 4]);   // a chart where the halves have real shape
  let lidTotal = 0, faceTotal = 0, misread = 0;
  for (const piece of copyChartPieces(base.g, axes3, EXTENT)) {
    const pts = embedRays(piece.rays, axes3) as (Vec3 | null)[];
    const h = convexHull3Sparse(pts);
    const lids = clipBoxFaces(h, EXTENT);
    lidTotal += lids.size;
    faceTotal += h.faces.length;
    // Every face called a lid must really lie on the box; every face NOT called
    // one must have a vertex strictly inside it.
    h.faces.forEach((f, i) => {
      const onBox = f.loop.every((v) => {
        const p = pts[v];
        return p !== null && [0, 1, 2].some((a) => Math.abs(Math.abs(p[a]) - EXTENT) < 1e-6 * EXTENT);
      });
      if (lids.has(i) !== onBox) misread++;
    });
  }
  check('truncation lids are identified exactly',
    misread === 0 && lidTotal > 0 && lidTotal < faceTotal,
    `${lidTotal} lids of ${faceTotal} faces, ${misread} misread`);
}

// ─── 3. camera ───────────────────────────────────────────────────────────────

console.log('\ncamera — projectDepth and viewFrameAt');

{
  const cams = [
    makeOrthographicCamera({ xLo: -2, xHi: 2, yLo: -2, yHi: 2, imgW: 400, imgH: 400 }),
    makePerspectiveCamera({
      position: [3, 2, 5], target: [0, 0, 0], up: [0, 1, 0],
      fov: 45, near: 0.01, far: 100, imgW: 400, imgH: 400,
    }),
  ];
  for (const [i, cam] of cams.entries()) {
    const tag = i === 0 ? 'ortho' : 'persp';
    let agree = true;
    for (const p of CUBE) {
      const a = cam.project(p[0], p[1], p[2]);
      const b = cam.projectDepth(p[0], p[1], p[2]);
      if (a && (!b || Math.abs(a.px - b.px) > 1e-9 || Math.abs(a.py - b.py) > 1e-9)) agree = false;
    }
    check(`${tag}: projectDepth pixels match project`, agree);

    const frame = viewFrameAt(cam, [0, 0, 0], 1e-3);
    check(`${tag}: viewFrameAt returns a frame`, frame !== null);
    if (frame) {
      const d = (u: readonly number[], v: readonly number[]): number => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
      const orth = Math.max(
        Math.abs(d(frame.right, frame.up)),
        Math.abs(d(frame.right, frame.toViewer)),
        Math.abs(d(frame.up, frame.toViewer)),
      );
      // Exact for the orthographic camera; the perspective one is differenced
      // through a nonlinear divide, so the frame is orthonormal to O(h).
      const tol = i === 0 ? 1e-12 : 1e-3;
      check(`${tag}: view frame is orthonormal`, orth < tol, `max |dot| ${orth.toExponential(1)}`);
      // Moving toward the viewer must decrease depth.
      const t = frame.toViewer;
      const near = cam.projectDepth(t[0] * 0.1, t[1] * 0.1, t[2] * 0.1)!;
      const far = cam.projectDepth(-t[0] * 0.1, -t[1] * 0.1, -t[2] * 0.1)!;
      check(`${tag}: depth increases away from the viewer`, near.depth < far.depth);
    }
  }
}

// ─── 3b. glassDepth — the linework's depth cue ───────────────────────────────

console.log('\nglassDepth — how much body sits between a stroke and the viewer');

{
  // (a) A cube, from the body diagonal: three faces toward the viewer, three away.
  //     Worked out by hand — from the far corner the ray leaves through the near
  //     corner, so δ is the full body diagonal 2√3; from the near corner it is 0.
  const cube = convexHull3(CUBE);
  const s = 1 / Math.sqrt(3);
  const diag: Vec3 = [s, s, s];
  const near = (p: Vec3, want: number, name: string): void =>
    check(`cube along (1,1,1): ${name}`, Math.abs(glassDepth(cube, p, diag) - want) < 1e-12,
      `δ=${glassDepth(cube, p, diag).toFixed(6)} want ${want.toFixed(6)}`);
  near([1, 1, 1], 0, 'near corner is on the surface (δ=0)');
  near([-1, -1, -1], 2 * Math.sqrt(3), 'far corner is a full body diagonal deep');
  near([0, 0, 0], Math.sqrt(3), 'centre is half of that');
  near([0, 1, 1], 0, 'a visible edge midpoint is on the surface');
  near([0, -1, -1], Math.sqrt(3), 'a hidden edge midpoint is buried');

  // The classical count: exactly the three edges meeting at the far corner are
  // hidden, the other nine are on the visible surface.
  let hidden = 0;
  for (const e of cube.edges) {
    const a = CUBE[e.a], b = CUBE[e.b];
    if (glassDepth(cube, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], diag) > 1e-12) hidden++;
  }
  check('cube along (1,1,1): 3 of 12 edges hidden', hidden === 3, `got ${hidden}`);

  // Axis-aligned: the whole far face is exactly 2 deep, the near face on the surface.
  const zc = convexHull3(CUBE);
  check('cube along +z: far face is 2 deep, near face 0',
    Math.abs(glassDepth(zc, [0, 0, -1], [0, 0, 1]) - 2) < 1e-12
    && glassDepth(zc, [0, 0, 1], [0, 0, 1]) === 0);
}

{
  // (b) The real bodies, against an INDEPENDENT oracle: bisect on plain
  //     point-in-body membership (every face satisfied) to find how far the ray
  //     stays inside. That uses only the halfspace TEST, never the closed form.
  const inside = (h: Hull3, p: Vec3, tol: number): boolean =>
    h.faces.every((f) => f.normal[0] * p[0] + f.normal[1] * p[1] + f.normal[2] * p[2] <= f.offset + tol);
  const bisect = (h: Hull3, p: Vec3, v: Vec3): number => {
    const span = 8 * h.scale;
    const tol = 1e-12 * h.scale;                      // MEMBER_TOL below, in scene units
    const at = (t: number): Vec3 => [p[0] + v[0] * t, p[1] + v[1] * t, p[2] + v[2] * t];
    if (!inside(h, at(span * 1e-9), tol)) return 0;   // leaves immediately
    let lo = 0, hi = span;
    if (inside(h, at(hi), tol)) return hi;            // never leaves (should not happen)
    for (let i = 0; i < 80; i++) {
      const mid = (lo + hi) / 2;
      if (inside(h, at(mid), tol)) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  };

  let seed2 = 24681357;
  const rnd2 = (): number => { seed2 = (seed2 * 1103515245 + 12345) & 0x7fffffff; return seed2 / 0x7fffffff; };
  const dirs: Vec3[] = [];
  for (let i = 0; i < 60; i++) {
    const z = 2 * rnd2() - 1, th = 2 * Math.PI * rnd2(), r = Math.sqrt(1 - z * z);
    dirs.push([r * Math.cos(th), r * Math.sin(th), z]);
  }

  /** The exit face's n·v — it sets how sharp both bounds below can legitimately be. */
  const exitSlope = (h: Hull3, p: Vec3, v: Vec3): number => {
    let best = Infinity, nv = Infinity;
    for (const f of h.faces) {
      const d = f.normal[0] * v[0] + f.normal[1] * v[1] + f.normal[2] * v[2];
      if (d <= 1e-12) continue;
      const s = (f.offset - (f.normal[0] * p[0] + f.normal[1] * p[1] + f.normal[2] * p[2])) / d;
      if (s < best) { best = s; nv = d; }
    }
    return nv;
  };

  const MEMBER_TOL = 1e-12;
  let worstRatio = 0, samples = 0, worstLip = 0, ruleBreaks = 0;
  for (const c of [...copiesFor('base'), ...copiesFor('nested')]) {
    const pts = projected(c.g);
    const h = convexHull3Sparse(pts);
    if (h.degenerate) continue;
    // Which faces own each hull corner — for the surface rule below.
    const owner = new Map<number, number[]>();
    h.faces.forEach((f, fi) => { for (const i of f.loop) (owner.get(i) ?? owner.set(i, []).get(i)!).push(fi); });

    for (const v of dirs) {
      // Smallest slope among faces the ray can exit through: the Lipschitz constant.
      let minNv = Infinity;
      for (const f of h.faces) {
        const d = f.normal[0] * v[0] + f.normal[1] * v[1] + f.normal[2] * v[2];
        if (d > 1e-12) minNv = Math.min(minNv, d);
      }

      for (const e of h.edges) {
        const a = pts[e.a], b = pts[e.b];
        if (!a || !b) continue;
        const L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
        let prev = NaN;
        for (const t of [0, 0.25, 0.5, 0.75, 1]) {
          const p: Vec3 = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
          const got = glassDepth(h, p, v);
          samples++;
          // The bisection reads the boundary through a membership tolerance, and a
          // ray grazing its exit face at slope n·v travels tol/(n·v) before that
          // tolerance notices. So its disagreement is bounded, and by that — not by
          // a chosen constant. (Here the closed form is the accurate one.)
          const allowed = (MEMBER_TOL * h.scale) / exitSlope(h, p, v) + 1e-12 * h.scale;
          worstRatio = Math.max(worstRatio, Math.abs(got - bisect(h, p, v)) / allowed);

          // δ is a min of affine functions with gradients −n/(n·v), so it is
          // Lipschitz along a stroke with constant 1/min(n·v) — NOT 1. Near a
          // grazing exit face the weight may therefore fade over a short run; the
          // ramp saturates well before that becomes a visible step.
          if (Number.isFinite(prev)) {
            const bound = (0.25 * L) / minNv;
            worstLip = Math.max(worstLip, Math.abs(got - prev) / (bound + 1e-300));
          }
          prev = got;
        }
      }

      // The classical hidden-line rule, recovered: a point of the surface is
      // visible (δ=0) exactly when it LIES ON some face that points at the viewer.
      // Ties the new quantity to the old rule where the old rule was valid, and
      // would catch a sign flip anywhere in the formula. "Lies on" must be the
      // geometric test — the coplanar merge drops collinear points from a face's
      // loop, so a corner can sit on a face it is not a loop member of.
      const touch = 1e-7 * h.scale;
      for (const i of owner.keys()) {
        const p = pts[i];
        if (!p) continue;
        const anyFront = h.faces.some((f) => {
          const n = f.normal;
          return n[0] * v[0] + n[1] * v[1] + n[2] * v[2] > 1e-9
            && Math.abs(n[0] * p[0] + n[1] * p[1] + n[2] * p[2] - f.offset) <= touch;
        });
        if ((glassDepth(h, p, v) <= touch) !== anyFront) ruleBreaks++;
      }
    }
  }
  check('glassDepth matches an independent membership bisection, to that oracle\'s own bound',
    worstRatio <= 1, `worst ${worstRatio.toPrecision(12)}× the allowed slack over ${samples.toLocaleString()} samples`);
  check('glassDepth respects its Lipschitz bound 1/min(n·v) along a stroke',
    worstLip <= 1 + 1e-9, `worst ${worstLip.toPrecision(12)}× the bound`);
  check('δ=0 at a corner ⟺ a face there points at the viewer (classical rule recovered)',
    ruleBreaks === 0, `${ruleBreaks} breaks`);
}

// ─── 4. the overlay end to end ───────────────────────────────────────────────

console.log('\noverlay — drawing ℙ(K) into a buffer');

{
  const W = 320, H = 320;
  // Frame the body from its own extent so the test does not depend on autofit.
  const live = basePts.filter((p): p is Vec3 => p !== null);
  let lo = Infinity, hi = -Infinity;
  for (const p of live) for (const c of [p[0], p[1]]) { lo = Math.min(lo, c); hi = Math.max(hi, c); }
  const pad = (hi - lo) * 0.15;
  const cam = makeOrthographicCamera({ xLo: lo - pad, xHi: hi + pad, yLo: lo - pad, yHi: hi + pad, imgW: W, imgH: H });

  const rgba = new Uint8Array(W * H * 4);
  fillBackground(rgba, W, H, [255, 255, 255]);
  const r = drawConvexBody(rgba, W, H, {
    points: basePts, hull: baseHull, camera: cam, style: DEFAULT_BODY_STYLE,
  });

  check('overlay: faces rasterized', r.facesDrawn > 0, `${r.facesDrawn} faces`);
  check('overlay: body covers a plausible share of the frame',
    r.pixelsCovered > W * H * 0.05 && r.pixelsCovered < W * H,
    `${r.pixelsCovered}/${W * H} px`);

  let inked = 0, corners = 0;
  for (let i = 0; i < W * H; i++) {
    if (rgba[i * 4] !== 255 || rgba[i * 4 + 1] !== 255 || rgba[i * 4 + 2] !== 255) inked++;
  }
  // The image corners are outside the padded body, so they must stay background.
  for (const [x, y] of [[0, 0], [W - 1, 0], [0, H - 1], [W - 1, H - 1]]) {
    const i = (y * W + x) * 4;
    if (rgba[i] === 255 && rgba[i + 1] === 255 && rgba[i + 2] === 255) corners++;
  }
  check('overlay: ink was laid down', inked > 0, `${inked} px`);
  check('overlay: nothing painted outside the body (corners clean)', corners === 4, `${corners}/4`);
  check('overlay: coverage is bluer than the background',
    (() => {
      let blueish = 0;
      for (let i = 0; i < W * H; i++) {
        const o = i * 4;
        if (rgba[o + 2] > rgba[o] + 4) blueish++;
      }
      return blueish > r.pixelsCovered * 0.5;
    })(), 'body is drawn in its own hue');
}

console.log(failures === 0
  ? '\nC-32 figure gates PASSED.\n'
  : `\nC-32 figure gates FAILED (${failures}).\n`);
process.exit(failures === 0 ? 0 : 1);
