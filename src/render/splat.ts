/**
 * Per-point deposit closures for the streaming accumulator.
 *
 *   makeIntegerDeposit  — nearest-pixel snap; +1 per point. The original
 *                         behaviour: cheap, sharp, occasionally pixelated
 *                         on sparse 1-D limit curves.
 *
 *   makeTentSplatDeposit — sub-pixel tent kernel of half-width `radius`.
 *                         Splat weight at offset (dx, dy) from the
 *                         floating-point point (px, py) is
 *                           wx · wy   where  wx = max(0, 1 − |dx − fx|/R),
 *                                            wy = max(0, 1 − |dy − fy|/R),
 *                                            fx = px − floor(px),
 *                                            R  = radius + 0.5.
 *                         Total weight per point ≈ (R)² ≈ (radius+0.5)² (not
 *                         normalised; compensate via --gamma / --tone).
 *
 * Both factories return a closure of identical signature
 *   (px, py, channel) → boolean
 * so the streaming hot loop is uniform; the radius / kernel choice is
 * resolved once at start-up. V8 inlines the monomorphic closure cleanly,
 * so --splat 0 has no measurable overhead vs the pre-refactor inline path.
 */

export type DepositFn = (px: number, py: number, channel: number) => boolean;

export function makeIntegerDeposit(
  data: Float32Array, W: number, H: number, K: number,
): DepositFn {
  return (px, py, channel) => {
    const ix = Math.floor(px + 0.5);
    const iy = Math.floor(py + 0.5);
    if (ix < 0 || ix >= W || iy < 0 || iy >= H) return false;
    data[(iy * W + ix) * K + channel] += 1;
    return true;
  };
}

export function makeTentSplatDeposit(
  data: Float32Array, W: number, H: number, K: number, radius: number,
): DepositFn {
  if (!Number.isInteger(radius) || radius < 1) {
    throw new Error(`splat radius must be a positive integer (got ${radius})`);
  }
  const R = radius + 0.5;  // tent extends a half-pixel past edge pixels
  const invR = 1 / R;
  return (px, py, channel) => {
    const cx = Math.floor(px), cy = Math.floor(py);
    const fx = px - cx, fy = py - cy;
    let any = false;
    for (let dy = -radius; dy <= radius; dy++) {
      const y = cy + dy;
      if (y < 0 || y >= H) continue;
      const ay = Math.abs(dy - fy);
      if (ay >= R) continue;
      const wy = (R - ay) * invR;
      for (let dx = -radius; dx <= radius; dx++) {
        const x = cx + dx;
        if (x < 0 || x >= W) continue;
        const ax = Math.abs(dx - fx);
        if (ax >= R) continue;
        const wx = (R - ax) * invR;
        data[(y * W + x) * K + channel] += wx * wy;
        any = true;
      }
    }
    return any;
  };
}
