/**
 * Figure-quality offline drawing of a convex body in ℝ³ — the offline
 * counterpart of `app/convexMesh.ts` (which does the same job with three.js in
 * the live viewer).
 *
 * The body is the SHADOW of a cone under a chart ℝⁿ ⇢ ℝ³: the convex hull of
 * the projected generators (`core/hull3`). A convex body has exactly two
 * boundary crossings along any ray, so it is drawn as two shaded layers rather
 * than a pile of alpha-blended triangles:
 *
 *   1. depth-buffer every face, keeping the NEAREST and the FARTHEST hit;
 *   2. composite back layer, then front layer, over whatever is already there.
 *
 * That is what makes it read as glass over a limit set: no double-blended seams
 * where triangles of one flat face meet, and correct two-layer translucency.
 *
 * Linework carries the hidden-line cue that makes a wireframe read as a solid,
 * and the question behind it is a yes/no one: DOES THE RAY FROM THIS POINT TO THE
 * CAMERA PASS THROUGH THE BODY'S INTERIOR? For a convex solid that is one ray
 * intersection (`glassDepth` > 0). Hidden pieces are drawn at `backWidthScale` /
 * `backOpacityScale`, everything else at full weight — two weights, no gradient,
 * because an edge that is hidden is hidden along its whole length. Set both
 * scales to 1 for the uniform three.js-tube weight, where the translucent body
 * alone separates the two sides.
 *
 * Hidden pieces are also laid down BEFORE the body so the glass composites over
 * them and dims them again; visible pieces go on top. Vertex dots sit only at
 * true hull CORNERS (the vertices in the face loops), never at a ray that merely
 * lands on a face's interior.
 *
 * The test is asked of a POINT, not of an edge, so it treats the hull's own
 * boundary edges, an explicit 1-skeleton whose chords cut through the interior,
 * and vertex dots all the same way. Strokes are cut into short pieces and each
 * piece asks for itself, so a chord that dives from the surface into the body
 * switches weight exactly where it goes behind. Nothing here classifies faces,
 * so no per-face verdict can disagree with itself at a shared corner.
 *
 * Lighting is derived FROM THE CAMERA (`viewFrameAt`), so a key light always
 * falls from the viewer's upper left whatever chart or framing is in play — no
 * per-figure light tuning. Facing is the sign of `dot(normal, toViewer)`, exact
 * for the orthographic auto view and finite-differenced for perspective presets.
 *
 * Generic: takes points, a hull, and a camera. No group data.
 */

import { viewFrameAt, type Camera } from '../core/camera.ts';
import { clipBoxFaces } from '../core/convexChart.ts';
import type { Hull3, Vec3 } from '../core/hull3.ts';
import { drawDiscAA, drawThickLineAA, type RGB } from './lineRaster.ts';

export interface ConvexBodyStyle {
  /** Base color of the translucent body (0..255 per channel). */
  faceColor: RGB;
  edgeColor: RGB;
  vertexColor: RGB;
  /** Opacity of the near / far surface layer. */
  frontOpacity: number;
  backOpacity: number;
  /** Ambient fraction of the shade; the rest is the camera-relative key light. */
  ambient: number;
  /** Edge strokes, at their FRONT-of-body weight. */
  edgeWidth: number;
  edgeOpacity: number;
  /** Dots at hull corners; radius 0 turns them off. */
  vertexRadius: number;
  vertexOpacity: number;
  /**
   * The depth cue. Linework buried behind the body is drawn at this fraction of
   * the surface width / opacity; 1 and 1 give the uniform weight the live
   * three.js viewer has, where only the glass separates the two sides.
   */
  backWidthScale: number;
  backOpacityScale: number;
}

export const DEFAULT_BODY_STYLE: ConvexBodyStyle = {
  faceColor:   [55, 137, 184],
  edgeColor:   [31, 95, 135],
  vertexColor: [224, 150, 80],
  frontOpacity: 0.22,
  backOpacity:  0.10,
  ambient: 0.45,
  edgeWidth: 1.6,
  edgeOpacity: 0.85,
  vertexRadius: 0,
  vertexOpacity: 0.9,
  // Width and opacity do NOT contribute equally. Narrowing a stroke leaves its
  // core just as dark — an anti-aliased line keeps a fully-inked centre until it
  // goes sub-pixel — so opacity has to carry the contrast, and width is there for
  // the thinner LOOK. Measured on the figure path, hidden linework at (0.5, 0.35)
  // lands near half the ink of visible linework, where a hidden-line drawing
  // reads; splitting the reduction evenly across the two only reached 0.71.
  backWidthScale: 0.5,
  backOpacityScale: 0.35,
};

export interface DrawConvexBodyOptions {
  /** Scene-space points, indexed as the hull's loops index them. `null` = the
   *  chart sent this generator to infinity; faces using it are already absent. */
  points: readonly (Vec3 | null)[];
  hull: Hull3;
  camera: Camera;
  style: ConvexBodyStyle;
  /**
   * Edges to stroke, as index pairs. Omit to use the hull's own face-boundary
   * edges, classified visible/hidden by face facing (the exact, preferred path).
   * Passing an explicit list — e.g. a cone's true 1-skeleton — opts into the
   * per-pixel depth-probe fallback, since those edges have no hull-face adjacency.
   */
  edges?: readonly (readonly [number, number])[] | null;
  drawFaces?: boolean;
  drawEdges?: boolean;
  drawVertices?: boolean;
  /**
   * Truncation half-width the hull was cut at, if it was. Hull faces lying ON
   * that box are the flat lids the cut left behind, not boundary of the body:
   * they are dropped, along with their edges and the vertices only they own, so
   * the body is OPEN where it was cut and reads as running off rather than
   * ending at a wall. Omit for an untruncated body.
   */
  clipExtent?: number;
}

export interface DrawConvexBodyResult {
  /** Faces that rasterized to at least one pixel. */
  facesDrawn: number;
  /** Pixels covered by the body. */
  pixelsCovered: number;
  /** Stroke segments on the visible surface / buried behind the body. */
  strokesSurface: number;
  strokesBuried: number;
}

interface Screen { px: number; py: number; depth: number }

const dot3 = (u: Vec3, v: readonly [number, number, number]): number =>
  u[0] * v[0] + u[1] * v[1] + u[2] * v[2];

/** Draw one convex body into an RGBA buffer. Returns coverage statistics. */
export function drawConvexBody(
  rgba: Uint8Array, w: number, h: number, o: DrawConvexBodyOptions,
): DrawConvexBodyResult {
  const { points, hull, camera, style } = o;
  const drawFaces = o.drawFaces ?? true;
  const drawEdges = o.drawEdges ?? true;
  const drawVertices = o.drawVertices ?? (style.vertexRadius > 0);
  const none: DrawConvexBodyResult = { facesDrawn: 0, pixelsCovered: 0, strokesSurface: 0, strokesBuried: 0 };
  if (hull.degenerate || hull.faces.length === 0) return none;

  // Lids left by a truncation are not part of the body; drop them entirely.
  const lids = o.clipExtent ? clipBoxFaces(hull, o.clipExtent) : new Set<number>();

  // ── project every point once ────────────────────────────────────────────────
  const scr: (Screen | null)[] = points.map((p) => (p ? camera.projectDepth(p[0], p[1], p[2]) : null));
  const visible = (i: number): boolean => scr[i] !== null;

  // ── per-face facing, shade, and screen bbox ────────────────────────────────
  const probe = hull.scale * 1e-4 || 1e-6;
  const shadeFront = new Float64Array(hull.faces.length);
  const shadeBack = new Float64Array(hull.faces.length);
  const usable: boolean[] = [];

  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  hull.faces.forEach((f, fi) => {
    const ok = !lids.has(fi) && f.loop.length >= 3 && f.loop.every(visible);
    usable.push(ok);
    if (!ok) return;

    // Face centroid in scene space — the anchor for the local view frame.
    let cx = 0, cy = 0, cz = 0;
    for (const i of f.loop) { const p = points[i]!; cx += p[0]; cy += p[1]; cz += p[2]; }
    const k = f.loop.length;
    const frame = viewFrameAt(camera, [cx / k, cy / k, cz / k], probe);
    if (!frame) { usable[fi] = false; return; }

    // Key light from the viewer's upper left, mixed with a headlight so nothing
    // ever goes fully black; both are camera-relative, so this is framing-proof.
    const l: Vec3 = normalize([
      0.55 * frame.toViewer[0] - 0.45 * frame.right[0] + 0.50 * frame.up[0],
      0.55 * frame.toViewer[1] - 0.45 * frame.right[1] + 0.50 * frame.up[1],
      0.55 * frame.toViewer[2] - 0.45 * frame.right[2] + 0.50 * frame.up[2],
    ]);
    const lam = Math.max(0, dot3(f.normal, l));
    shadeFront[fi] = style.ambient + (1 - style.ambient) * lam;
    // The far surface is seen from inside and through the near one: flatter and
    // dimmer, which is what gives the layered depth cue.
    shadeBack[fi] = style.ambient * 0.85 + (1 - style.ambient) * 0.4 * Math.max(0, -dot3(f.normal, l));

    for (const i of f.loop) {
      const s = scr[i]!;
      if (s.px < x0) x0 = s.px; if (s.px > x1) x1 = s.px;
      if (s.py < y0) y0 = s.py; if (s.py > y1) y1 = s.py;
    }
  });

  if (!Number.isFinite(x0)) return none;

  // ── layer buffers, allocated over the body's image bbox only ───────────────
  const bx = Math.max(0, Math.floor(x0)), by = Math.max(0, Math.floor(y0));
  const bw = Math.min(w - 1, Math.ceil(x1)) - bx + 1;
  const bh = Math.min(h - 1, Math.ceil(y1)) - by + 1;
  if (bw <= 0 || bh <= 0) return none;

  const nearDepth = new Float32Array(bw * bh).fill(Infinity);
  const farDepth = new Float32Array(bw * bh).fill(-Infinity);
  const nearFace = new Int32Array(bw * bh).fill(-1);
  const farFace = new Int32Array(bw * bh).fill(-1);

  let facesDrawn = 0;
  hull.faces.forEach((f, fi) => {
    if (!usable[fi]) return;
    let hit = false;
    // Convex loop ⇒ a fan triangulation is valid.
    for (let i = 1; i + 1 < f.loop.length; i++) {
      hit = rasterTriangle(
        scr[f.loop[0]]!, scr[f.loop[i]]!, scr[f.loop[i + 1]]!,
        fi, bx, by, bw, bh, nearDepth, nearFace, farDepth, farFace,
      ) || hit;
    }
    if (hit) facesDrawn++;
  });

  // ── linework, weighted by how much glass is in front of it ─────────────────
  //
  // Every stroke is cut into short segments and each segment asks the one
  // question that matters: does the ray from here to the camera pass through the
  // body? That is `glassDepth > 0` — an exact ray/convex-solid intersection,
  // needing no face adjacency, no depth buffer, and no front/back classification.
  // It applies unchanged to hull edges, to interior 1-skeleton chords, and to
  // vertex dots.
  //
  // Hidden segments are drawn at the reduced weight AND laid down BEFORE the body,
  // so the translucent solid composites over them and dims them again "through the
  // glass"; visible segments go on top afterwards at full weight. Vertex dots sit
  // only at real hull CORNERS (the vertices in the face loops), never at rays that
  // merely land on a face's interior.
  // "Hidden" is a yes/no question — does the ray to the camera pass through the
  // body's interior — so `hull.scale` enters only as the tolerance scale it is
  // documented to be, never as a perceptual quantity.
  const INTERIOR = 1e-6 * (hull.scale || 1);
  const SEGMENT_PX = 8;                      // stroke subdivision, in screen pixels

  /** A stroke segment, already projected, and whether the body hides it. */
  interface Seg { a: Screen; b: Screen }
  const buried: Seg[] = [], surface: Seg[] = [];

  /** Does the ray from this point to the camera cross the body's interior? */
  const isHidden = (p: Vec3): boolean => {
    const frame = viewFrameAt(camera, p, probe);
    return frame !== null && glassDepth(hull, p, frame.toViewer) > INTERIOR;
  };

  /**
   * Cut one scene-space segment into pieces and ask each. A stroke is not hidden
   * as a whole: a 1-skeleton chord can leave the surface and dive inside, so the
   * answer has to be per piece.
   */
  const addStroke = (pa: Vec3, pb: Vec3, sa: Screen, sb: Screen): void => {
    const n = Math.min(32, Math.max(1,
      Math.ceil(Math.hypot(sb.px - sa.px, sb.py - sa.py) / SEGMENT_PX)));
    let head = sa;
    for (let i = 1; i <= n; i++) {
      const u = i / n;
      const tail = i === n ? sb
        : camera.projectDepth(pa[0] + (pb[0] - pa[0]) * u, pa[1] + (pb[1] - pa[1]) * u, pa[2] + (pb[2] - pa[2]) * u);
      if (!tail) return;
      const m = (i - 0.5) / n;
      const hidden = isHidden([pa[0] + (pb[0] - pa[0]) * m, pa[1] + (pb[1] - pa[1]) * m, pa[2] + (pb[2] - pa[2]) * m]);
      (hidden ? buried : surface).push({ a: head, b: tail });
      head = tail;
    }
  };

  if (drawEdges) {
    // The hull's own boundary edges, or an explicit list (e.g. the cone's true
    // 1-skeleton, whose chords cut through the interior). Same treatment either
    // way — glass depth does not care where an edge came from.
    const list: readonly (readonly [number, number])[] = o.edges ?? hull.edges
      .filter((e) => !lids.has(e.f0) && !lids.has(e.f1) && usable[e.f0] && usable[e.f1])
      .map((e) => [e.a, e.b] as const);
    for (const [a, b] of list) {
      const pa = points[a], pb = points[b], sa = scr[a], sb = scr[b];
      if (pa && pb && sa && sb) addStroke(pa, pb, sa, sb);
    }
  }

  const dots: { s: Screen; hidden: boolean }[] = [];
  if (drawVertices && style.vertexRadius > 0) {
    const corners = new Set<number>();
    hull.faces.forEach((f, fi) => { if (usable[fi]) for (const i of f.loop) corners.add(i); });
    for (const i of corners) {
      const p = points[i], s = scr[i];
      if (p && s) dots.push({ s, hidden: isHidden(p) });
    }
  }

  // Two weights, no gradient: full in front, reduced behind.
  const strokeSeg = ({ a, b }: Seg, hidden: boolean): void =>
    drawThickLineAA(rgba, w, h, a.px, a.py, b.px, b.py, style.edgeColor,
      style.edgeWidth * (hidden ? style.backWidthScale : 1),
      style.edgeOpacity * (hidden ? style.backOpacityScale : 1));
  const drawDot = ({ s }: { s: Screen }, hidden: boolean): void =>
    drawDiscAA(rgba, w, h, s.px, s.py, style.vertexRadius * (hidden ? style.backWidthScale : 1),
      style.vertexColor, style.vertexOpacity * (hidden ? style.backOpacityScale : 1));

  // 1. behind the glass — thinner and lighter, and about to be dimmed again
  for (const s of buried) strokeSeg(s, true);
  for (const d of dots) if (d.hidden) drawDot(d, true);

  // 2. the translucent body (far layer, then near layer) — dims the linework under it
  let pixelsCovered = 0;
  const fc = style.faceColor;
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      const i = y * bw + x;
      const nf = nearFace[i];
      if (nf < 0) continue;
      pixelsCovered++;
      if (!drawFaces) continue;
      const idx = ((by + y) * w + bx + x) * 4;
      const ff = farFace[i];
      if (ff >= 0 && ff !== nf) blend(rgba, idx, fc, shadeBack[ff], style.backOpacity);
      blend(rgba, idx, fc, shadeFront[nf], style.frontOpacity);
    }
  }

  // 3. on the visible surface — full weight, over everything
  for (const s of surface) strokeSeg(s, false);
  for (const d of dots) if (!d.hidden) drawDot(d, false);

  return { facesDrawn, pixelsCovered, strokesSurface: surface.length, strokesBuried: buried.length };
}

// ── internals ────────────────────────────────────────────────────────────────

/**
 * δ(p): how far the ray from `p` toward the viewer travels before it leaves the
 * body — the optical path length through the glass, in scene units. Zero on the
 * visible surface, growing with how deeply `p` is buried behind it.
 *
 * The body is the intersection of its faces' halfspaces {n·x ≤ offset}, so the
 * ray p + s·v leaves it at the smallest s where some face is met from the inside:
 *
 *     δ(p) = min over faces with n·v > 0 of (offset − n·p)/(n·v),   clamped at 0.
 *
 * This is a plain ray/convex-solid intersection. It needs no face adjacency, no
 * depth buffer and no front/back classification, so it treats a hull edge, an
 * interior 1-skeleton chord and a vertex dot alike, and being a function of the
 * POINT it is continuous — two strokes meeting at a corner necessarily agree
 * there. Both matter: the scheme it replaced classified each hull edge front/back
 * from its two faces (after unioning near-coplanar faces into regions to stop a
 * shallow crease flipping the verdict), had no answer at all for an interior
 * chord, and could not help putting a hard weight jump wherever the verdict
 * changed. Measured against this same intersection over 208,295 verdicts, that
 * scheme called 473 of them wrongly — one an edge buried 1.37 body-diameters
 * deep, drawn as if it sat on the near surface.
 *
 * Only the SIGN of δ is used. Its magnitude is a tempting weight cue — "how much
 * glass am I looking through" — but δ falls to zero at an occluded edge's own
 * endpoints, so grading by it makes hidden edges fade in and out at both ends and
 * stop reading as being round the back. An edge that is hidden is hidden along
 * its whole length.
 *
 * A face the caller is not drawing (a truncation lid) still bounds the solid, so
 * every face counts here; the cut is placed off-frame anyway.
 *
 * Exported so `scripts/tests/c32-figure-gates.ts` can check it against a
 * bisection on plain point-in-body membership, which shares none of this code.
 */
export function glassDepth(
  hull: Hull3, p: Vec3, toViewer: readonly [number, number, number],
): number {
  let best = Infinity;
  for (const f of hull.faces) {
    const nv = dot3(f.normal, toViewer);
    if (nv <= 1e-12) continue;                 // this face cannot be met from inside
    const s = (f.offset - dot3(f.normal, p)) / nv;
    if (s < best) best = s;
  }
  return best === Infinity || best < 0 ? 0 : best;
}

function normalize(v: number[]): Vec3 {
  const l = Math.hypot(v[0], v[1], v[2]);
  return l > 0 ? [v[0] / l, v[1] / l, v[2] / l] : [0, 0, 1];
}

/** src-over blend of `color` scaled by `shade`, at `alpha`. */
function blend(rgba: Uint8Array, idx: number, color: RGB, shade: number, alpha: number): void {
  if (alpha <= 0) return;
  const ia = 1 - alpha;
  for (let c = 0; c < 3; c++) {
    const v = Math.min(255, color[c] * shade);
    rgba[idx + c] = Math.round(v * alpha + rgba[idx + c] * ia);
  }
  rgba[idx + 3] = 255;
}

/**
 * Scanline-rasterize one triangle into the near/far depth layers. Depth is
 * interpolated affinely in screen space — for separating the two surfaces of a
 * convex body (and for the hidden-edge test) the perspective error is far below
 * the gap between them. Returns whether any pixel was touched.
 */
function rasterTriangle(
  A: Screen, B: Screen, C: Screen, face: number,
  bx: number, by: number, bw: number, bh: number,
  nearDepth: Float32Array, nearFace: Int32Array,
  farDepth: Float32Array, farFace: Int32Array,
): boolean {
  const ax = A.px - bx, ay = A.py - by;
  const bx2 = B.px - bx, by2 = B.py - by;
  const cx = C.px - bx, cy = C.py - by;

  const area = (bx2 - ax) * (cy - ay) - (cx - ax) * (by2 - ay);
  if (Math.abs(area) < 1e-12) return false;
  const inv = 1 / area;

  const minX = Math.max(0, Math.floor(Math.min(ax, bx2, cx)));
  const maxX = Math.min(bw - 1, Math.ceil(Math.max(ax, bx2, cx)));
  const minY = Math.max(0, Math.floor(Math.min(ay, by2, cy)));
  const maxY = Math.min(bh - 1, Math.ceil(Math.max(ay, by2, cy)));
  if (minX > maxX || minY > maxY) return false;

  let touched = false;
  for (let y = minY; y <= maxY; y++) {
    const py = y + 0.5;
    for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5;
      const w0 = ((bx2 - px) * (cy - py) - (cx - px) * (by2 - py)) * inv;
      const w1 = ((cx - px) * (ay - py) - (ax - px) * (cy - py)) * inv;
      const w2 = 1 - w0 - w1;
      if (w0 < -1e-7 || w1 < -1e-7 || w2 < -1e-7) continue;
      const d = w0 * A.depth + w1 * B.depth + w2 * C.depth;
      const i = y * bw + x;
      if (d < nearDepth[i]) { nearDepth[i] = d; nearFace[i] = face; }
      if (d > farDepth[i]) { farDepth[i] = d; farFace[i] = face; }
      touched = true;
    }
  }
  return touched;
}
