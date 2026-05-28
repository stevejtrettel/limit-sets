/**
 * Flag-variety visualization — SKELETON. To be picked up later.
 *
 * The first attempt at a 3D embedding F → R³ via (x, y, θ_line) produced
 * three parallel fractal stripes — two distinct problems compounding:
 *
 *   1. F₂ walker overcounting × negative scalars in r_i³.
 *      Z/3 ∗ Z/3 has the relation r_i³ ≡ I in PGL₃, but in our GL₃ lift
 *      r_i³ = λ_i I with λ_i < 0 (computed: λ₁ = −1/((1−c²)(1−d²)²) for
 *      the Pappus matrices — det(r₁) is negative because of the structural
 *      identity (cd−1)² − (d−c)² = (1−c²)(1−d²)). So walking r_i³ sends
 *      a lifted basepoint (p, n) ∈ S²×S² to (−p, −n). In the embedding,
 *      this gives the SAME (x, y) but θ shifted by π — two sheets of the
 *      same fractal at line angles π apart.
 *
 *   2. Chart wraparound at θ = ±π. A 1-d fractal curve's line direction
 *      wanders enough that ANY chart F → R³ with a 1-d angular coordinate
 *      will have the curve cross the wrap boundary, splitting visually.
 *
 *   3 stripes ≈ 2 sheets × wrap-split.
 *
 * The 6-dim flag action and 3-dim dual action in flagAction.ts are
 * mathematically correct and ready to wire into any of the approaches
 * below. The basepoint pipeline (compute point basepoint via primary
 * action on γ; line basepoint via dual action on REVERSED γ; concatenate)
 * is straightforward — see the prior version of main.ts in git history
 * for the boilerplate, or the deleted branch in repBuilder.ts callers.
 *
 * Recommended approach for tomorrow: A (decorated 2D). It directly shows
 * point + line, no topological gymnastics, standard in the literature.
 *
 * ─── Approach A: Decorated RP² (RECOMMENDED) ───────────────────────────
 *
 *   Render each orbit element as a point in the affine chart PLUS a short
 *   oriented line segment in the line direction (−n_y, n_x) at that point.
 *
 *   Implementation sketch:
 *     - SceneEmbedding interface produces 3D points only; this needs a
 *       new render path. Probably add a sibling to `makeInstancedSpheres`:
 *         makeInstancedSegments(material, aMidpoint, aDirection, length, aColor)
 *       that uses a Three.js InstancedMesh of a thin box / line geometry.
 *     - In main.ts, the flag mode branches the renderer (not the embedding):
 *       instead of `buildOrbitInstances(embedding, orbit, ...)`, call a
 *       new `buildFlagDecorations(flagOrbit, lineLength, ...)` that emits
 *       midpoints + directions.
 *     - Reuses the existing 2D camera and autofit (no 3D camera complexity).
 *     - Line length tunable via a new "decoration length" slider.
 *
 * ─── Approach B: Dual scatter ──────────────────────────────────────────
 *
 *   A second SceneEmbedding (stateDim 6) that plots n in its affine chart
 *   (n_x/n_z, n_y/n_z, 0). User flips between 'plane' and 'dual' in the
 *   embedding dropdown to see the two complementary fractals.
 *
 *   Easiest add: no new render machinery. Just a new SceneEmbedding alongside
 *   planeEmbedding, plus the flag-mode pipeline in main.ts (action, dual
 *   action, concatenated basepoint).
 *
 * ─── Approach C: Folded smooth 3D ──────────────────────────────────────
 *
 *   Like the first (broken) attempt but with sin(2θ) instead of θ as the
 *   third coordinate. sin(2θ) is continuous AND invariant under θ → θ + π
 *   (collapses the sign-flip sheets). Cost: 2-to-1 folding — distinct line
 *   directions can project to the same z.
 *
 *   Quick to try (one-line change from the deleted naive version), keeps
 *   the 3D camera. May still be visually muddy. Probably worth comparing
 *   to A as a second viz mode.
 *
 * ─── Approach D: R⁴ → R³ projection ────────────────────────────────────
 *
 *   (x, y, R·cos 2θ, R·sin 2θ) is a smooth embedding F → R⁴ (no folding,
 *   no wrap, no sheet duplication). Project to R³ via dropping one axis
 *   (asymmetric) or PCA-fit on the orbit (axes lose direct meaning).
 *   Most faithful but axes become opaque. Defer.
 */

// Intentionally exports nothing yet — placeholder until one of the
// approaches above is wired in. Importers will get a clear "no such
// export" error rather than a silently-broken embedding.
export {};
