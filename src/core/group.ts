/**
 * Abstract group action.
 *
 * A `GroupAction` describes a finitely-generated group acting on a state
 * space of dimension `stateDim`. State vectors are flat Float64Arrays, with
 * one state stored contiguously at an offset (so many states can share one
 * backing buffer in the BFS / DFS hot loops).
 *
 * Generator codes are 0..numGenerators-1. `inverse[g]` is the code of g⁻¹;
 * the orbit walker uses it to skip backtracking edges (no g · g⁻¹).
 *
 * `normalize` is optional — implementations like sp6 normalize to a unit
 * sphere after each apply to keep Float64 stable. Actions whose orbits live
 * in a bounded chart (IFS, affine, Möbius on the disk, …) leave it off.
 */

export interface GroupAction {
  readonly numGenerators: number;
  readonly stateDim:      number;
  /** Length = numGenerators. `inverse[g]` is the code of g⁻¹. */
  readonly inverse:       Uint8Array;
  apply(
    g: number,
    src: Float64Array, sOff: number,
    dst: Float64Array, dOff: number,
  ): void;
  normalize?(buf: Float64Array, off: number): void;
}
