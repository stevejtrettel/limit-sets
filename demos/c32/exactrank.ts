/**
 * exactRank — the dimension of the span of a set of integer vectors over ℚ, computed
 * exactly (no floats, no rounding) by fraction-free Gaussian elimination in BigInt.
 *
 * Rank only asks whether each pivot is zero or nonzero, never its value — so we never
 * divide. We clear an entry below a pivot by CROSS-MULTIPLYING:
 *     rows[i] := pivot[c]·rows[i] − rows[i][c]·pivot          (stays in integers)
 * which zeroes rows[i][c]. Scaling a row by a nonzero scalar leaves rank unchanged, so
 * counting the pivots gives the exact dimension. BigInt keeps every step exact; for our
 * matrices the intermediate entries stay tiny by BigInt standards, so no gcd reduction
 * is needed.
 */
export function exactRank(intRows: readonly (readonly number[])[]): number {
  if (intRows.length === 0) return 0;
  const rows = intRows.map((r) => r.map((x) => BigInt(x)));   // exact integer copies
  const cols = rows[0].length;

  let rank = 0;
  for (let c = 0; c < cols && rank < rows.length; c++) {
    const pivot = rows.findIndex((row, i) => i >= rank && row[c] !== 0n);
    if (pivot < 0) continue;                                  // no pivot in this column
    [rows[rank], rows[pivot]] = [rows[pivot], rows[rank]];    // bring the pivot row up

    const p = rows[rank];
    for (let i = rank + 1; i < rows.length; i++) {
      if (rows[i][c] !== 0n) {                                // clear rows[i][c]
        const a = p[c], b = rows[i][c];
        rows[i] = rows[i].map((x, k) => a * x - b * p[k]);
      }
    }
    rank++;
  }
  return rank;
}
