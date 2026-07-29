/**
 * Offline density render of an Sp(6) paper figure — a thin plugin over
 * scripts/render/renderDriver.ts. See that file for the shared flags and the two
 * render modes (view-preset vs auto).
 *
 *   node scripts/render/sp6-paper.ts c32 15
 *   node scripts/render/sp6-paper.ts thin-1 15 --tone 0.5 --gamma 0.8
 *
 * ids are the FIGURE ids from `@/examples/hypergeometric/paperFigures`, not
 * catalog labels: arith-1…arith-3, thin-1…thin-3, c47, c55, c32.
 *
 * FRAMING. Frame the figure in the `sp6-paper` demo and hit "save framing for
 * render"; that writes outputs/presets/sp6-paper-view-preset.json, which this
 * script reads by default and which pins the camera, the chart and the figure.
 * `--no-preset` forces the PCA autofit instead. A preset holds exactly one
 * figure, so rendering the whole nine-panel set means re-framing each one — or
 * running the rest with `--no-preset`.
 *
 * DEPTH COSTS MORE THAN THE APPENDIX SET. These are degree-6 symplectic groups
 * on the 4-letter free alphabet {A, A⁻¹, B, B⁻¹}, so the word tree is 3^N,
 * against 2^N for the appendix's 3-letter free-product alphabet. Depth 15 here
 * is ≈28.7M words; the same depth in the appendix demo is ≈98k. The driver
 * streams the orbit (O(depth) memory), so this costs time rather than RAM.
 *
 * SEEDING is the pinned γ = TBT (T = A⁻¹B), the word the paper's §5 names, for
 * every figure — so a rendered figure is reproducible from the text alone rather
 * than from whatever the auto-search happened to find. The banner reports that
 * figure's spectral gap |λ₁/λ₂| and flags it when it falls under PAPER_MIN_GAP,
 * which is the point at which the basepoint stops being trustworthy.
 *
 * TONE. Figures render on white, per the house rule. A dim limit set gets fixed
 * with `--tone` (try 0.4–0.6) and `--gamma`, never with `--bg black`.
 */
import { runRender, type OverlayContext } from './renderDriver.ts';
import {
  FIGURES, ROW_TITLES, figureExample, figureAction, seedPaperFigure,
  PAPER_MIN_GAP, type PaperFigure,
} from '../../src/examples/hypergeometric/paperFigures.ts';
import { paletteForSymplectic } from '../../src/examples/hypergeometric/palette.ts';
import type { ViewPreset } from '../../src/examples/hypergeometric/viewPreset.ts';
import { embeddingFromPreset } from '../../src/core/viewPreset.ts';
import { fitAutoChartEmbedding, type ChartEmbedding } from '../../src/core/chart.ts';
import {
  c32Chart, copiesFor, copyCone, copyChartPieces, copyClipExtent, coneBoundedInChart,
  DEFAULT_COORD, DEFAULT_DENOM, DEFAULT_AXES, type Copy,
} from '../../src/examples/hypergeometric/c32-domain.ts';
import { convexHull3Sparse, hullViolation, type Vec3 } from '../../src/core/hull3.ts';
import { drawConvexBody, DEFAULT_BODY_STYLE } from '../../src/render/convexBody.ts';
import type { SceneEmbedding } from '../../src/core/scene.ts';

// ─── Domain overlay ℙ(K) — the Fig 4 figures ────────────────────────────────
//
// A FIXED-CONFIGURATION painter: the figure record says which family of copies
// to draw, and they are always wireframe + body with no container. That is why
// this does not share code with `c32.ts`, whose equivalent is
// driven by a dozen CLI flags (--domain/--copies/--container/--wire/…) and needs
// the plumbing to resolve them. Both go through the same exported primitives in
// `c32-domain` and `render/convexBody`; only the configuration differs.

const DOMAIN_OPACITY = 0.85;
const hex = (c: number): Vec3 =>
  [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255];

/** The chart the render is going through: the preset's, or ℙ(K)-adapted. */
const domainChart = (preset: ViewPreset | null, fig: PaperFigure): ChartEmbedding =>
  preset ? embeddingFromPreset(preset.projection)
         : c32Chart(fig.domain?.coord ?? DEFAULT_COORD, DEFAULT_DENOM, DEFAULT_AXES);

function projectRays(rays: readonly (readonly number[])[], embedding: SceneEmbedding): (Vec3 | null)[] {
  const out = new Float64Array(3);
  return rays.map((r) => {
    const buf = new Float64Array(r);
    return embedding.embed(buf, 0, out, 0) ? [out[0], out[1], out[2]] as Vec3 : null;
  });
}

function drawCopy(ctx: OverlayContext, copy: Copy, chart: ChartEmbedding, extent: number, scale: number): void {
  const pieces = copyChartPieces(copy.g, chart, extent);
  if (pieces.length === 0) { ctx.log(`  ${copy.label}: degenerate in this chart, skipped`); return; }
  for (const piece of pieces) {
    const pts = projectRays(piece.rays, ctx.embedding);
    const hull = convexHull3Sparse(pts);
    if (hull.degenerate) continue;
    const live = pts.filter((p): p is Vec3 => p !== null);
    const r = drawConvexBody(ctx.rgba, ctx.imgW, ctx.imgH, {
      points: pts, hull, camera: ctx.camera,
      style: {
        ...DEFAULT_BODY_STYLE,
        faceColor: hex(copy.body), edgeColor: hex(copy.edge), vertexColor: hex(copy.vertex),
        frontOpacity: DEFAULT_BODY_STYLE.frontOpacity * DOMAIN_OPACITY,
        backOpacity: DEFAULT_BODY_STYLE.backOpacity * DOMAIN_OPACITY,
        edgeWidth: DEFAULT_BODY_STYLE.edgeWidth * scale,
        vertexRadius: 0,
      },
      // The true 1-skeleton only survives on an uncut piece; a truncated half is
      // a different polytope, so it falls back to the hull's own edges.
      edges: piece.clipped ? undefined : copyCone(copy.g).edges,
      drawFaces: true, drawEdges: true, drawVertices: false,
      clipExtent: piece.clipped ? extent : undefined,
    });
    const residual = hullViolation(live, hull);
    const tag = piece.clipped ? `${copy.label} (half ${piece.sign > 0 ? '+' : '−'})` : copy.label;
    ctx.log(`  ${tag}: ${hull.faces.length} faces, ${live.length} corners, ` +
      `${r.pixelsCovered.toLocaleString()} px` +
      (residual > 1e-9 ? `  ⚠ hull residual ${residual.toExponential(1)}` : ''));
  }
}

function drawDomain(ctx: OverlayContext, fig: PaperFigure): void {
  if (!fig.domain) return;
  const preset = ctx.preset as ViewPreset | null;
  const chart = domainChart(preset, fig);
  const copies = copiesFor(fig.domain.copies);
  // Stroke weights are quoted for a ~2000px figure and scale up from there.
  const scale = Math.max(1, Math.max(ctx.imgW, ctx.imgH) / 2000);
  const extent = copyClipExtent(fig.domain.copies, ctx.embedding);
  const unbounded = copies.filter((c) => !coneBoundedInChart(copyCone(c.g), chart)).length;
  ctx.log(`[sp6-paper-render] domain: ${copies.length} copies (${fig.domain.copies}), wireframe + body`
    + (unbounded ? `, ${unbounded} unbounded in this chart → drawn as truncated halves` : ''));
  for (const copy of copies) drawCopy(ctx, copy, chart, extent, scale);
}

await runRender<PaperFigure>({
  family: 'sp6-paper', defaultExampleId: FIGURES[0].id, defaultDepth: 15,
  resolveExample: (id) => FIGURES.find((f) => f.id === id),
  exampleId: (f) => f.id,
  banner: (f) => `${f.label} — ${ROW_TITLES[f.row]} · ${figureExample(f).label} · ${f.caption}`,
  makeAction: (f) => figureAction(f),
  findSeed: (action) => {
    const s = seedPaperFigure(action);
    const warn = s.meetsGap ? '' : `  ⚠ gap below ${PAPER_MIN_GAP}`;
    return {
      basepoint: s.basepoint,
      note: `γ = ${s.name} (pinned), |λ₁| ≈ ${s.lambdaMax.toFixed(4)}, `
        + `gap |λ₁/λ₂| = ${s.gap.toFixed(2)}, drift = ${s.drift.toExponential(2)}${warn}`,
    };
  },
  paletteForScheme: paletteForSymplectic,

  // A domain figure defaults to the ℙ(K)-adapted chart, where the copies are
  // bounded convex bodies; in a PCA chart they cross the hyperplane at infinity
  // and come out as truncated halves. Other figures keep the PCA autofit.
  fitEmbedding: (pilot, f) =>
    (f.domain ? c32Chart(f.domain.coord, DEFAULT_DENOM, DEFAULT_AXES) : fitAutoChartEmbedding(pilot)),
  presetEmbedding: (preset) => embeddingFromPreset((preset as unknown as ViewPreset).projection),

  // Λ alone would set the frame and crop the domain, so hand the autofit every
  // copy's projected corners too.
  autofitExtras: (embedding, f) => {
    if (!f.domain) return new Float64Array(0);
    const pts: number[] = [];
    for (const copy of copiesFor(f.domain.copies)) {
      for (const p of projectRays(copyCone(copy.g).rays, embedding)) {
        if (p) pts.push(p[0], p[1], p[2]);
      }
    }
    return new Float64Array(pts);
  },

  overlay: (ctx, f) => drawDomain(ctx, f),
});
