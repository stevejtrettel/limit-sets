/**
 * Abstract group action.
 *
 * A `GroupAction` describes a finitely-generated group acting (linearly, for the
 * matrix families here) on a state space of dimension `stateDim`. For projective
 * limit sets the state vector is a representative in Rⁿ of a point of RP^{n-1},
 * normalized to the sphere S^{n-1}; `stateDim` = n is the AMBIENT dimension, not
 * the dimension of the limit set. State vectors are flat Float64Arrays, one
 * state stored contiguously at an offset (so many states share one backing
 * buffer in the BFS / DFS hot loops).
 *
 * Generator codes are 0..numGenerators-1. `inverse[g]` is the code of g⁻¹;
 * the orbit walker uses it to skip backtracking edges (no g · g⁻¹).
 *
 * APPLY CONVENTION — `apply(g, src, …, dst, …)` writes dst = g · src, i.e. the
 * generator acts on the LEFT. A word given in "apply order" [g₀, g₁, …, g_{k-1}]
 * is applied left-to-right (apply g₀ first, then g₁, …), so the resulting group
 * element / matrix is the REVERSE product  g_{k-1} ⋯ g₁ g₀. (Helpers that print
 * a word as a group element therefore reverse it; see e.g. o5/seed.ts.)
 *
 * `normalize` is optional — projective matrix families normalize to the unit
 * sphere after each apply to keep Float64 stable (and so chart fitters can
 * assume |state| = 1). Actions whose orbits live in a bounded chart (IFS,
 * affine, Möbius on the disk, …) leave it off.
 */

export interface GroupAction {
  readonly numGenerators: number;
  /** Ambient dimension n: state vectors are in Rⁿ (limit set in RP^{n-1}). */
  readonly stateDim:      number;
  /** Length = numGenerators. `inverse[g]` is the code of g⁻¹. */
  readonly inverse:       Uint8Array;
  /** Write dst = g · src (left action). See APPLY CONVENTION above. */
  apply(
    g: number,
    src: Float64Array, sOff: number,
    dst: Float64Array, dOff: number,
  ): void;
  normalize?(buf: Float64Array, off: number): void;
}
