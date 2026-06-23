/**
 * Compatibility shim — this module moved to `core/seed.ts` during the
 * clarity refactor (see REFACTOR_PLAN.md). Re-exported here so existing
 * imports keep working until their call sites are migrated; remove once
 * no consumer imports from `core/loxodromic` (Phase 5).
 */
export * from './seed.ts';
