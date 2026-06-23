/**
 * Shared startup-validation harness for example datasets.
 *
 * Every family validates its examples the same way at the top level: run a
 * per-example check, THROW if any failed (printing each failure), else log a
 * one-line-per-example summary with any warnings. Only the per-example check
 * (`validateExample`) and the one-line summary string are family-specific; this
 * harness owns the loop, the throw, and the formatting.
 *
 *   export function validateAllExamples(examples) {
 *     return runValidation('o5', examples.map(validateExample), {
 *       idOf:      (r) => r.example.label,
 *       summaryOf: (r) => `λ_max=${r.lambdaMax.toFixed(3)} drift=${r.drift.toFixed(4)}`,
 *     });
 *   }
 */

export interface ValidationBase {
  passed: boolean;
  errors: readonly string[];
  warnings: readonly string[];
}

export interface ValidationFormat<R> {
  /** Identifier shown per row / in failure messages (e.g. example id or label). */
  idOf: (r: R) => string;
  /** The per-example summary string (e.g. "λ_max=… drift=…"). */
  summaryOf: (r: R) => string;
  /** Left-pad width for the id column. Default 16. */
  padId?: number;
}

export function runValidation<R extends ValidationBase>(
  familyTag: string,
  results: R[],
  format: ValidationFormat<R>,
): R[] {
  const failed = results.filter((r) => !r.passed);
  if (failed.length > 0) {
    console.error(`[${familyTag}] ${failed.length} example(s) failed validation:`);
    for (const r of failed) console.error(`  ${format.idOf(r)}: ${r.errors.join('; ')}`);
    throw new Error(`${familyTag} example validation failed`);
  }
  console.log(`[${familyTag}] example validation:`);
  const pad = format.padId ?? 16;
  for (const r of results) {
    const warns = r.warnings.length > 0 ? `  ⚠ ${r.warnings.join('; ')}` : '';
    console.log(`       ${format.idOf(r).padEnd(pad)}  ${format.summaryOf(r)}${warns}`);
  }
  return results;
}
