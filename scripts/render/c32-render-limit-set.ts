/**
 * Offline FIGURE render of C-32: the limit set Λ with the ping-pong domain ℙ(K)
 * — or its rosette of rotations, or its nested branch images — drawn over it as
 * shaded convex bodies. This is the paper-figure path; `demos/c32/` is the
 * interactive one they are framed in.
 *
 *   node scripts/render/c32-render-limit-set.ts [depth] [flags...]
 *
 * Domain flags (driver flags — --max-dim, --gamma, --tone, --bg, --splat,
 * --depth, --no-preset, --refresh — are documented in renderDriver.ts):
 *
 *   --copies base|rotated|nested   K | Sᵏ·K (×6) | T⁻¹Sᵏ·K (×6)     [preset, else base]
 *   --domain full|body|wire|none   shaded body + edges | body only |
 *                                  edges only | Λ alone              [preset, else full]
 *   --wire hull|skeleton|none      edges of the projected shadow's 3-D hull, or
 *                                  ℙ(K)'s faithful 680-edge 1-skeleton, or none.
 *                                  Same choice as the viewer's "wireframe edges".
 *                                  [preset, else hull]
 *   --container / --no-container   overlay the original containing K, faint,
 *                                  behind rotated/nested images  [preset, else off]
 *   --vertices                     dot every extremal ray on the silhouette
 *   --domain-opacity F             scale the body's translucency (default 1)
 *   --back-edges S                 fraction of the surface weight that linework
 *                                  buried behind a body keeps — the depth cue,
 *                                  applied to width and opacity alike. 1 =
 *                                  uniform, the live viewer's look; omit for the
 *                                  figure default (0.55 width / 0.6 opacity)
 *   --clip-extent M                how far past the visible geometry a domain
 *                                  that runs through infinity is truncated [20]
 *
 * Chart flags (AUTO mode only — a view preset carries its own chart):
 *
 *   --coords companion|u|rosette   coordinate system            [u]
 *   --patch N                      affine patch z_N = 1, 1-based [1]
 *   --axes a,b,c                   view axes, 1-based            [3,5,6]
 *
 * A copy that crosses the hyperplane at infinity is NOT skipped: its affine
 * picture is two convex halves running off to opposite sides, and both are drawn
 * (truncated at `--clip-extent`, well outside the frame, so they read as running
 * off rather than as ending). `copyChartPieces` cuts them exactly in ℝ⁶.
 *
 * Which copies are bounded still depends on the patch. In the default u-basis z₁
 * patch only Δ₀ is bounded, so K and all six nested images draw whole while the
 * rotations k≠0 split. For all six rotations bounded at once use the `rosette`
 * system, whose denominator is a covector picked to bound them simultaneously:
 *
 *   --copies rotated --coords rosette --patch 1 --axes 2,3,6 --domain-opacity 0.45
 *
 * (No coordinate patch manages it; the companion patches get five of six.)
 *
 * How the picture is built: Λ comes from the density accumulator as usual; the
 * domain is painted on top by `render/convexBody` as a two-layer translucent
 * solid — the SHADOW of the 6-dimensional cone, i.e. the 3-D hull of its
 * projected rays (`core/hull3`), which is what a chart of ℝ⁶ actually shows.
 * Both go through the same embedding and camera, so they register exactly.
 *
 * With a view preset saved from the demo ("save view"), the framing AND the
 * domain layer are reproduced; flags override. Without one, the render falls
 * back to the notebook's known-good chart, orthographically autofit to Λ
 * together with the domain so the domain is never cropped.
 */

import { runRender, type OverlayContext } from './renderDriver.ts';
import {
  EXAMPLES, symplecticAction, seedSymplectic, type SymplecticExample,
} from '../../src/examples/hypergeometric/degree6-symplectic.ts';
import { paletteForSymplectic } from '../../src/examples/hypergeometric/palette.ts';
import type { C32ViewPreset } from '../../src/examples/hypergeometric/viewPreset.ts';
import {
  c32Chart, coneBoundedInChart, copiesFor, copyChartPieces, copyCone,
  DEFAULT_AXES, DEFAULT_COORD, DEFAULT_DENOM, type Copy, type CopyMode,
} from '../../src/examples/hypergeometric/c32-domain.ts';
import { embeddingFromPreset } from '../../src/core/viewPreset.ts';
import { convexHull3Sparse, hullViolation, type Vec3 } from '../../src/core/hull3.ts';
import type { ConvexCone } from '../../src/core/convex.ts';
import type { SceneEmbedding } from '../../src/core/scene.ts';
import type { ChartEmbedding } from '../../src/core/chart.ts';
import { drawConvexBody, DEFAULT_BODY_STYLE, type ConvexBodyStyle } from '../../src/render/convexBody.ts';
import type { RGB } from '../../src/render/lineRaster.ts';

// ─── flags ────────────────────────────────────────────────────────────────────

const ARGS = process.argv.slice(2);
const flag = (name: string): string | null => {
  const i = ARGS.indexOf(name);
  return i >= 0 && i + 1 < ARGS.length ? ARGS[i + 1] : null;
};

const COPIES_FLAG = flag('--copies') as CopyMode | null;
const DOMAIN_FLAG = flag('--domain');
const WIRE_FLAG = flag('--wire') as 'hull' | 'skeleton' | 'none' | null;
const CONTAINER_FLAG = ARGS.includes('--container') ? true : ARGS.includes('--no-container') ? false : null;
const VERTICES = ARGS.includes('--vertices');
const DOMAIN_OPACITY = flag('--domain-opacity') ? parseFloat(flag('--domain-opacity')!) : 1;
const CLIP_EXTENT = flag('--clip-extent') ? parseFloat(flag('--clip-extent')!) : 20;
const BACK_EDGES = flag('--back-edges') ? parseFloat(flag('--back-edges')!) : null;

/** The hidden-line cue, overridden as one number by `--back-edges`. */
const BACK_SCALES = BACK_EDGES === null
  ? { backWidthScale: DEFAULT_BODY_STYLE.backWidthScale, backOpacityScale: DEFAULT_BODY_STYLE.backOpacityScale }
  : { backWidthScale: BACK_EDGES, backOpacityScale: BACK_EDGES };

/** Which edges the wireframe draws: flag, else the preset, else 'hull'. */
function wireMode(preset: C32ViewPreset | null): 'hull' | 'skeleton' | 'none' {
  return WIRE_FLAG ?? preset?.domain?.edges ?? 'hull';
}
/** Overlay the containing K: flag, else the preset, else off. */
function showContainer(preset: C32ViewPreset | null): boolean {
  return CONTAINER_FLAG ?? preset?.domain?.container ?? false;
}

/** The AUTO-mode chart: the notebook's framing unless overridden. Flags are
 *  1-based (they name z₁…z₆); the chart builder is 0-based. */
function autoChart(): ChartEmbedding {
  const coords = flag('--coords') ?? DEFAULT_COORD;
  const patch = flag('--patch') ? parseInt(flag('--patch')!, 10) - 1 : DEFAULT_DENOM;
  const axes = flag('--axes')
    ? flag('--axes')!.split(',').map((s) => parseInt(s, 10) - 1) as [number, number, number]
    : DEFAULT_AXES;
  return c32Chart(coords, patch, axes);
}

/** Resolve the domain layer: CLI flag first, then the preset, then the default. */
function resolveLayer(preset: C32ViewPreset | null): { copies: CopyMode; body: boolean; edges: boolean } {
  const copies = COPIES_FLAG ?? preset?.domain?.copies ?? 'base';
  // The demo's 'coloring' mode tints Λ by membership instead of drawing hulls;
  // offline there is no such pass, so it falls back to the full solid.
  const mode = DOMAIN_FLAG ?? ({
    'wire+body': 'full', body: 'body', wire: 'wire', none: 'none', coloring: 'full',
  } as Record<string, string>)[preset?.domain?.mode ?? 'wire+body'] ?? 'full';
  return {
    copies,
    body: mode === 'full' || mode === 'body',
    edges: (mode === 'full' || mode === 'wire') && wireMode(preset) !== 'none',
  };
}

// ─── the drawable domain, in the render's own view ───────────────────────────

/** 0xRRGGBB → an 0..255 triple (the rasterizers' color convention). */
const hex = (h: number): RGB => [(h >> 16) & 255, (h >> 8) & 255, h & 255];

/** Project a cone's rays into scene space; null where the chart sends one to ∞. */
function projectRays(cone: ConvexCone, embedding: SceneEmbedding): (Vec3 | null)[] {
  const buf = new Float64Array(cone.dim);
  const out = new Float64Array(3);
  return cone.rays.map((r) => {
    for (let j = 0; j < cone.dim; j++) buf[j] = r[j];
    return embedding.embed(buf, 0, out, 0) ? [out[0], out[1], out[2]] as Vec3 : null;
  });
}

/** The active copies as cones, skipping any that escapes the chart's patch. */
function drawableCopies(copies: CopyMode, chart: ChartEmbedding): { copy: Copy; cone: ConvexCone }[] {
  return copiesFor(copies)
    .map((copy) => ({ copy, cone: copyCone(copy.g) }))
    .filter(({ cone }) => coneBoundedInChart(cone, chart));
}

/** Per-copy style: its own hue, on the shared figure look. */
function styleFor(copy: Copy, scale: number): ConvexBodyStyle {
  return {
    ...DEFAULT_BODY_STYLE,
    faceColor: hex(copy.body),
    edgeColor: hex(copy.edge),
    vertexColor: hex(copy.vertex),
    frontOpacity: DEFAULT_BODY_STYLE.frontOpacity * DOMAIN_OPACITY,
    backOpacity: DEFAULT_BODY_STYLE.backOpacity * DOMAIN_OPACITY,
    // Line/dot weights scale with the image so a figure reads the same at any size.
    edgeWidth: DEFAULT_BODY_STYLE.edgeWidth * scale,
    vertexRadius: VERTICES ? 2.6 * scale : 0,
    ...BACK_SCALES,
  };
}

/**
 * Half-width of the truncation box for copies that run through infinity, in
 * chart units. Taken from geometry that is actually in frame — a high percentile
 * of the copies' own finite chart coordinates — times `--clip-extent`. A
 * percentile, not a max: rays near the hyperplane blow up, and the box must be
 * sized by the picture, not by them.
 */
function clipExtent(copies: CopyMode, embedding: SceneEmbedding): number {
  const mags: number[] = [];
  for (const copy of copiesFor(copies)) {
    for (const p of projectRays(copyCone(copy.g), embedding)) {
      if (p) mags.push(Math.abs(p[0]), Math.abs(p[1]), Math.abs(p[2]));
    }
  }
  if (mags.length === 0) return CLIP_EXTENT;
  mags.sort((a, b) => a - b);
  return (mags[Math.floor(mags.length * 0.6)] || 1) * CLIP_EXTENT;
}

/** The containing K, styled faintly (light gray, paler body, thinner wire). */
const FAINT: RGB = [154, 164, 174];
function faintStyle(scale: number): ConvexBodyStyle {
  return {
    ...DEFAULT_BODY_STYLE,
    faceColor: FAINT, edgeColor: FAINT, vertexColor: FAINT,
    frontOpacity: DEFAULT_BODY_STYLE.frontOpacity * DOMAIN_OPACITY * 0.5,
    backOpacity: DEFAULT_BODY_STYLE.backOpacity * DOMAIN_OPACITY * 0.5,
    edgeWidth: DEFAULT_BODY_STYLE.edgeWidth * scale * 0.7,
    vertexRadius: 0,
    ...BACK_SCALES,
  };
}

interface CopyDrawOpts {
  chart: ChartEmbedding;
  extent: number;
  scale: number;
  style: ConvexBodyStyle;
  edges: 'hull' | 'skeleton' | 'none';
  body: boolean;
  vertices: boolean;
}

/** Draw one copy g·K (split into halves at infinity where needed). Returns
 *  whether anything landed in frame and whether it was split. */
function drawCopyBody(
  ctx: OverlayContext, copy: Copy, o: CopyDrawOpts,
): { covered: number; split: boolean; degenerate: boolean } {
  const pieces = copyChartPieces(copy.g, o.chart, o.extent);
  if (pieces.length === 0) return { covered: 0, split: false, degenerate: true };
  let covered = 0;
  const split = pieces.some((p) => p.clipped);
  for (const piece of pieces) {
    const pts = piece.rays.map((r) => {
      const buf = new Float64Array(r), out = new Float64Array(3);
      return ctx.embedding.embed(buf, 0, out, 0) ? [out[0], out[1], out[2]] as Vec3 : null;
    });
    const live = pts.filter((p): p is Vec3 => p !== null);
    const hull = convexHull3Sparse(pts);
    if (hull.degenerate) continue;
    const r = drawConvexBody(ctx.rgba, ctx.imgW, ctx.imgH, {
      points: pts, hull, camera: ctx.camera, style: o.style,
      // The true 1-skeleton only survives on an uncut piece; a truncated half is
      // a different polytope, so it falls back to the hull's own edges.
      edges: o.edges === 'skeleton' && !piece.clipped ? copyCone(copy.g).edges : undefined,
      drawFaces: o.body, drawEdges: o.edges !== 'none', drawVertices: o.vertices,
      clipExtent: piece.clipped ? o.extent : undefined,
    });
    covered += r.pixelsCovered;
    const residual = hullViolation(live, hull);
    const tag = piece.clipped ? `${copy.label} (half ${piece.sign > 0 ? '+' : '−'})` : copy.label;
    ctx.log(`  ${tag}: ${hull.faces.length} faces, ${live.length} corners, ${r.pixelsCovered.toLocaleString()} px` +
      (o.edges !== 'none' ? `, ${r.strokesSurface} surface / ${r.strokesBuried} buried strokes` : '') +
      (residual > 1e-9 ? `  ⚠ hull residual ${residual.toExponential(1)}` : ''));
  }
  return { covered, split, degenerate: false };
}

function drawDomain(ctx: OverlayContext, preset: C32ViewPreset | null): void {
  const layer = resolveLayer(preset);
  if (!layer.body && !layer.edges) { ctx.log('[c32-render] domain: none'); return; }

  // The chart the render is going through: the preset's, or the auto one.
  const chart = preset ? embeddingFromPreset(preset.projection) : autoChart();
  const copies = copiesFor(layer.copies);
  const wire = wireMode(preset);

  // Stroke weights are quoted for a ~2000px figure and scale up from there;
  // they never go below the quoted values, or thin lines drop out entirely.
  const scale = Math.max(1, Math.max(ctx.imgW, ctx.imgH) / 2000);
  const extent = clipExtent(layer.copies, ctx.embedding);

  // The containing K, drawn first (behind) and faint. No-op for 'base' (K is the
  // domain) — matches the viewer.
  if (showContainer(preset) && layer.copies !== 'base') {
    const kExtent = clipExtent('base', ctx.embedding);
    const K = { label: 'K (container)', g: copiesFor('base')[0].g, edge: 0, vertex: 0, body: 0 };
    drawCopyBody(ctx, K, { chart, extent: kExtent, scale, style: faintStyle(scale),
      edges: wire, body: layer.body, vertices: false });
  }

  let drawn = 0, split = 0, offFrame = 0;
  for (const copy of copies) {
    const opts: CopyDrawOpts = { chart, extent, scale, style: styleFor(copy, scale),
      edges: layer.edges ? wire : 'none', body: layer.body, vertices: VERTICES };
    const res = drawCopyBody(ctx, copy, opts);
    if (res.degenerate) { ctx.log(`  ${copy.label}: degenerate in this chart, skipped`); continue; }
    if (res.split) split++;
    if (res.covered === 0) { offFrame++; continue; }
    drawn++;
  }

  ctx.log(`[c32-render] domain: ${drawn}/${copies.length} copies drawn (${layer.copies}, ` +
    `${layer.body ? 'body' : 'no body'}${layer.edges ? ` + ${wire} edges` : ''}` +
    (showContainer(preset) && layer.copies !== 'base' ? ', +K container' : '') + ')' +
    (split ? `, ${split} split into halves at infinity (truncated at ${extent.toPrecision(3)})` : '') +
    (offFrame ? `, ${offFrame} outside the frame` : ''));
}

// ─── the render ───────────────────────────────────────────────────────────────

await runRender<SymplecticExample>({
  family: 'c32', defaultExampleId: 'c32', defaultDepth: 13,
  extraValueFlags: ['--copies', '--domain', '--wire', '--domain-opacity',
                    '--coords', '--patch', '--axes', '--clip-extent', '--back-edges'],

  resolveExample: (id) => EXAMPLES.find((e) => e.id === id),
  exampleId: (e) => e.id,
  banner: (e) => `${e.label} (${e.status})`,
  // The domain layer changes the AUTO frame (it is fit around both), so it has
  // to key the accumulator cache too. The container enlarges the frame, so it's
  // in the key as well.
  variant: (_e, preset) => {
    const p = preset as C32ViewPreset | null;
    const l = resolveLayer(p);
    const container = showContainer(p) && l.copies !== 'base' ? '-K' : '';
    return `${l.copies}${preset ? '' : `-${autoChart().label}`}${l.body ? '' : '-nobody'}${container}`;
  },

  makeAction: (e) => symplecticAction(e),
  findSeed: (action) => {
    const s = seedSymplectic(action);
    return { basepoint: s.basepoint, note: `γ = ${s.name}, |λ_max| ≈ ${s.lambdaMax.toFixed(3)}, drift = ${s.drift.toFixed(4)}` };
  },
  paletteForScheme: paletteForSymplectic,

  // No PCA: the default figure uses the notebook's known-good chart, the same
  // one the demo opens on.
  fitEmbedding: () => autoChart(),
  presetEmbedding: (preset) => embeddingFromPreset((preset as unknown as C32ViewPreset).projection),

  // Keep every drawable copy inside the autofit frame — Λ alone would crop them.
  // The container K, when shown, is larger than its images, so include it too.
  autofitExtras: (embedding) => {
    const layer = resolveLayer(null);
    const pts: number[] = [];
    const add = (mode: CopyMode): void => {
      for (const { cone } of drawableCopies(mode, autoChart())) {
        for (const p of projectRays(cone, embedding)) if (p) pts.push(p[0], p[1], p[2]);
      }
    };
    add(layer.copies);
    if (showContainer(null) && layer.copies !== 'base') add('base');
    return new Float64Array(pts);
  },

  overlay: (ctx) => drawDomain(ctx, ctx.preset as C32ViewPreset | null),
});
