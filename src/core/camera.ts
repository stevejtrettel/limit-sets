/**
 * Camera — R³ scene point → pixel.
 *
 * Group-agnostic. Three factories:
 *   makePerspectiveCamera   — eye/target/up + fov, matches Three.js semantics
 *                             (use this to render a `ViewPreset` exported
 *                             from the browser at higher BFS depth).
 *   makeOrthographicCamera  — direct window into (x, y); z is ignored.
 *   fitViewBbox             — percentile bbox over a cloud of scene points,
 *                             used by autofit. Returns the rect + the raw
 *                             stats for logging; pair with
 *                             makeOrthographicCamera + resolveImageDims.
 *
 * `resolveImageDims(aspect, maxDim, …)` is the shared dim-rounding helper.
 */

export interface Camera {
  readonly imgW: number;
  readonly imgH: number;
  project(x: number, y: number, z: number): { px: number; py: number } | null;
}

// ─── Dim resolution ────────────────────────────────────────────────────────

export interface DimOptions {
  /** Floor for the shorter image dimension. Default 128. */
  minDim?: number;
  /** Round each dim to a multiple of this. Default 16. */
  dimRound?: number;
}

function roundDim(d: number, minDim: number, dimRound: number): number {
  return Math.max(minDim, Math.round(d / dimRound) * dimRound);
}

/** Given a W/H aspect and a max long-side dim, resolve (imgW, imgH). */
export function resolveImageDims(
  aspect: number,
  maxDim: number,
  opts: DimOptions = {},
): { imgW: number; imgH: number } {
  const minDim   = opts.minDim   ?? 128;
  const dimRound = opts.dimRound ?? 16;
  if (aspect >= 1) {
    return {
      imgW: roundDim(maxDim, minDim, dimRound),
      imgH: roundDim(maxDim / aspect, minDim, dimRound),
    };
  }
  return {
    imgH: roundDim(maxDim, minDim, dimRound),
    imgW: roundDim(maxDim * aspect, minDim, dimRound),
  };
}

// ─── Perspective ───────────────────────────────────────────────────────────

/**
 * Three.js-compatible perspective camera spec, image-size-independent.
 * Suitable for serialisation (any group's view-preset JSON can carry one
 * of these directly).
 */
export interface PerspectiveSpec {
  position: readonly [number, number, number];
  target:   readonly [number, number, number];
  up:       readonly [number, number, number];
  /** Field of view in degrees (vertical). */
  fov:  number;
  near: number;
  far:  number;
}

export interface PerspectiveCameraOptions extends PerspectiveSpec {
  imgW: number;
  imgH: number;
}

function mat4Mul(a: Float64Array, b: Float64Array): Float64Array {
  const m = new Float64Array(16);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[r * 4 + k] * b[k * 4 + c];
      m[r * 4 + c] = s;
    }
  }
  return m;
}

function mat4LookAt(
  eye: readonly number[],
  target: readonly number[],
  up: readonly number[],
): Float64Array {
  const fx = target[0] - eye[0], fy = target[1] - eye[1], fz = target[2] - eye[2];
  const fl = Math.hypot(fx, fy, fz);
  const f0 = fx / fl, f1 = fy / fl, f2 = fz / fl;
  let s0 = f1 * up[2] - f2 * up[1];
  let s1 = f2 * up[0] - f0 * up[2];
  let s2 = f0 * up[1] - f1 * up[0];
  const sl = Math.hypot(s0, s1, s2);
  s0 /= sl; s1 /= sl; s2 /= sl;
  const u0 = s1 * f2 - s2 * f1;
  const u1 = s2 * f0 - s0 * f2;
  const u2 = s0 * f1 - s1 * f0;
  const m = new Float64Array(16);
  m[0]  = s0;  m[1]  = s1;  m[2]  = s2;  m[3]  = -(s0 * eye[0] + s1 * eye[1] + s2 * eye[2]);
  m[4]  = u0;  m[5]  = u1;  m[6]  = u2;  m[7]  = -(u0 * eye[0] + u1 * eye[1] + u2 * eye[2]);
  m[8]  = -f0; m[9]  = -f1; m[10] = -f2; m[11] =  (f0 * eye[0] + f1 * eye[1] + f2 * eye[2]);
  m[15] = 1;
  return m;
}

function mat4Perspective(
  fovDeg: number, aspect: number, near: number, far: number,
): Float64Array {
  const f = 1 / Math.tan((fovDeg * Math.PI / 180) / 2);
  const nf = 1 / (near - far);
  const m = new Float64Array(16);
  m[0]  = f / aspect;
  m[5]  = f;
  m[10] = (far + near) * nf;
  m[11] = 2 * far * near * nf;
  m[14] = -1;
  return m;
}

/** Three.js-compatible perspective camera. Uses image aspect = imgW/imgH. */
export function makePerspectiveCamera(opts: PerspectiveCameraOptions): Camera {
  const W = opts.imgW, H = opts.imgH;
  const VP = mat4Mul(
    mat4Perspective(opts.fov, W / H, opts.near, opts.far),
    mat4LookAt(opts.position, opts.target, opts.up),
  );

  return {
    imgW: W,
    imgH: H,
    project(x, y, z) {
      const cx = VP[0] *x + VP[1] *y + VP[2] *z + VP[3];
      const cy = VP[4] *x + VP[5] *y + VP[6] *z + VP[7];
      const cz = VP[8] *x + VP[9] *y + VP[10]*z + VP[11];
      const cw = VP[12]*x + VP[13]*y + VP[14]*z + VP[15];
      if (cw <= 0) return null;
      const invW = 1 / cw;
      const nz = cz * invW;
      if (nz < -1 || nz > 1) return null;
      const px = (cx * invW + 1) * 0.5 * W;
      const py = (1 - cy * invW) * 0.5 * H;
      if (px < 0 || px >= W || py < 0 || py >= H) return null;
      return { px, py };
    },
  };
}

// ─── Orthographic ──────────────────────────────────────────────────────────

export interface OrthographicCameraOptions {
  /** View rect in scene-space. y is inverted on output (top-left origin). */
  xLo: number; xHi: number;
  yLo: number; yHi: number;
  imgW: number;
  imgH: number;
}

export function makeOrthographicCamera(opts: OrthographicCameraOptions): Camera {
  const { xLo, xHi, yLo, yHi, imgW, imgH } = opts;
  const sx = imgW / (xHi - xLo);
  const sy = imgH / (yHi - yLo);
  const oyTop = yHi;

  return {
    imgW, imgH,
    project(x, y /* , z ignored */) {
      const px = (x - xLo) * sx;
      const py = (oyTop - y) * sy;
      if (px < 0 || px >= imgW || py < 0 || py >= imgH) return null;
      return { px, py };
    },
  };
}

// ─── Autofit bbox (orthographic) ───────────────────────────────────────────

export interface BboxOptions {
  /** Percentile trim per side. Default 0.20. */
  bboxTrim?: number;
  /** Cap halfX/halfY (or halfY/halfX) at this. Default 4. */
  maxAspect?: number;
  /** Fraction of image the view rect should fill. Default 0.92. */
  fitFill?: number;
}

export interface ViewBbox {
  /** View rect (after maxAspect clipping) — feed straight to makeOrthographicCamera. */
  xLo: number; xHi: number;
  yLo: number; yHi: number;
  /** Effective aspect (halfX / halfY); use with resolveImageDims. */
  aspect: number;
  /** Raw percentile bbox before clipping, kept around for logging. */
  rawXLo: number; rawXHi: number;
  rawYLo: number; rawYHi: number;
  rawAspect: number;
}

function percentile(arr: Float32Array, n: number, p: number): number {
  const tmp = arr.slice(0, n);
  tmp.sort();
  const idx = Math.max(0, Math.min(n - 1, Math.floor(n * p)));
  return tmp[idx];
}

/**
 * Percentile-bbox view fitter. Scans (x, y) of a cloud of scene points
 * stored as 3·count floats (x = scenePoints[3i], y = scenePoints[3i+1];
 * z is ignored — matches the SceneEmbedding bulk-write layout).
 */
export function fitViewBbox(
  scenePoints: ArrayLike<number>,
  count: number,
  opts: BboxOptions = {},
): ViewBbox {
  const bboxTrim  = opts.bboxTrim  ?? 0.20;
  const maxAspect = opts.maxAspect ?? 4;
  const fitFill   = opts.fitFill   ?? 0.92;

  const xs = new Float32Array(count);
  const ys = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    xs[i] = scenePoints[3 * i];
    ys[i] = scenePoints[3 * i + 1];
  }

  const rawXLo = percentile(xs, count, bboxTrim);
  const rawXHi = percentile(xs, count, 1 - bboxTrim);
  const rawYLo = percentile(ys, count, bboxTrim);
  const rawYHi = percentile(ys, count, 1 - bboxTrim);
  const xMed = percentile(xs, count, 0.5);
  const yMed = percentile(ys, count, 0.5);

  let halfX = Math.max(xMed - rawXLo, rawXHi - xMed) / fitFill;
  let halfY = Math.max(yMed - rawYLo, rawYHi - yMed) / fitFill;
  const rawAspect = halfX / halfY;
  // Aspect clamp: when the bbox is more elongated than maxAspect allows,
  // expand the *smaller* half so the view still contains the bbox (the
  // alternative — shrinking the larger half — would crop content and, in
  // the degenerate case where one half is 0, collapse the view entirely).
  if (rawAspect > maxAspect)          halfY = halfX / maxAspect;
  else if (rawAspect < 1 / maxAspect) halfX = halfY / maxAspect;

  return {
    xLo: xMed - halfX, xHi: xMed + halfX,
    yLo: yMed - halfY, yHi: yMed + halfY,
    aspect: halfX / halfY,
    rawXLo, rawXHi, rawYLo, rawYHi,
    rawAspect,
  };
}
