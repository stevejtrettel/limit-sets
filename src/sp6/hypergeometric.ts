/**
 * Compatibility shim — the rotation-number → polynomial machinery moved to
 * `core/polynomial.ts` during the clarity refactor (see REFACTOR_PLAN.md), since
 * it is a pure ability shared by both hypergeometric catalogs (and was already
 * reached into by o5). Re-exported here so existing imports keep working until
 * their call sites are migrated to `core/polynomial`; remove in Phase 2.
 */
export * from '../core/polynomial.ts';
