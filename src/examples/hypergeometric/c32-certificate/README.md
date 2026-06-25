# C-32 thinness certificate

An exact, integer-arithmetic certificate for the **C-32** hypergeometric group:
the four conditions that together witness it is a *thin* subgroup of Sp₆(ℤ) —
Zariski-dense in Sp₆ yet of infinite index in the arithmetic lattice. C-32 is one
of the open cases; this is the proposed ping-pong certificate from the "Thinness
of C-32" note (`background/c-32-5-30.pdf`).

```
npm run verify-c32
# or: node src/examples/hypergeometric/c32-certificate/verify.ts
```

All arithmetic is over integers (BigInt where exact rank is needed); exit code 0
iff every check passes. Everything is in the **u-basis**, where the rays and
facets live.

## Inputs — a group and a domain

Both come from the `c32` catalog example; the only hand-entered data are its
rotation tuples α, β and the cone's rays/facets.

- **The group.** `buildHyperGroup` derives the normal-form generators
  `S` (signed cyclic shift), `T⁻¹` (inverse transvection), and the involution `E`,
  plus the change of basis `P`, from the defining polynomials
  `f = cyclo(α) = x⁶−5x⁵+11x⁴−14x³+11x²−5x+1` and `g = cyclo(β) = x⁶+1` (paper §1).
  The eleven **branch maps** `G₀…G₁₀` are fixed words in `S, T⁻¹, E`
  (`coneCertificateMaps`):
  ```
  G0 = T⁻¹
  G1 = T⁻¹S      G2 = T⁻¹SE       G3 = −T⁻¹S²     G4 = −T⁻¹S²E
  G5 = T⁻¹S³     G6 = T⁻¹S³E      G7 = −T⁻¹S⁴     G8 = −T⁻¹S⁴E
  G9 = T⁻¹S⁵     G10 = T⁻¹S⁵E
  ```
  (The signs `εₖ = (−1)^{k+1}` are projectively irrelevant — they keep each image
  in the `y₀ > 0` chart.)
- **The domain K.** The ping-pong cone, in both dual views: its 254 extreme
  **rays** (from the `c32-cone` example) and its bounding **facets** `FACETS_H`
  (`facets.ts`), `K = { y : H·y ≥ 0 }`.

## The machinery: convex bodies, containment, translation

A convex body (here a cone) carries two dual views at once — its extreme **rays**
and its bounding **hyperplanes** `{ y : h·y ≥ 0 }`. Either determines it; each test
picks the convenient view of each body.

**Containment** `inside(Y, X)`: describe `X` by hyperplanes, `Y` by rays. Then
`Y ⊆ X` iff every extreme ray `r` of `Y` satisfies `h·r ≥ 0` for every hyperplane
`h` of `X`. All the cone checks reduce to this one boolean.

**Translation** `translate(X, G)`: applying `G` moves the two views *dually*, so
the pairing is preserved — rays by the left action `v ↦ G·v`, hyperplanes by the
inverse `h ↦ h·G⁻¹` (because `G·X = { w : (h·G⁻¹)·w ≥ 0 }` and `(h·G⁻¹)(Gv) = h·v`).

## The four checks

### 1 — Dominance: `K ⊆ Δ₀` (paper §3)

`Δ₀ = { y₀ > |yᵢ| }` is the dominance chamber; in the `y₀ = 1` chart it is the
cube `|yᵢ| < 1`, cut out by the ten half-spaces `y₀ ± yᵢ ≥ 0`. Two parts:

1. `inside(K, cube)` — every extreme ray satisfies `y₀ ≥ |yᵢ|`, so `K ⊆ Δ̄₀`. (The
   ten cube facets are genuine facets of `K` — the cone touches every box wall.)
2. A witness `z = (47,−1,−1,−1,−1,−1)` is *strictly* inside `K`, so `K` is
   full-dimensional; an open set inside the closed cube lies in the open cube, giving
   `X⁺ = ℙ(K°) ⊆ Δ₀`.

### 2 — Invariance: `GᵢK ⊆ K` for all 11 branch maps (paper §3–§4)

Since `K = cone(rays)` and each `Gᵢ` is linear, `GᵢK ⊆ K` iff every extreme ray maps
into `K`:
```
GᵢK ⊆ K   ⟺   for every ray r,  minₕ h·(Gᵢ r) ≥ 0      (11 × 254 × 77 integer checks).
```
The per-map worst value (integer, only its sign matters) reads as geometry:
**`0`** — some image ray lands exactly on `∂K` (the generic, delicate case: `T⁻¹S`
fixes `q = [1:−1:1:−1:1:−1] ∈ ∂K`); **`1`** — every image ray is strictly interior
(`T⁻¹S⁴`, `T⁻¹S⁴E`). Either way `GᵢK ⊆ K`.

Checks 1–2 are the ping-pong: projectively `T⁻¹(Y ∪ X⁺) ⊆ X⁺` with `X⁻ = E X⁺` and
`X ∩ Y = ∅`, so `Γ' = ⟨S, T⟩` plays ping-pong ⇒ it is discrete and of infinite index.

### 3 — Symplectic: `Γ' ⊆ Sp_Ω(ℤ)` (the ambient lattice)

`Ω_U = Pᵀ Ω P` (the integral alternating form pulled to the u-basis). Check that
`Ω_U` is symplectic (`Ω_Uᵀ = −Ω_U`, `det ≠ 0`) and that both generators preserve it
(`gᵀ Ω_U g = Ω_U`). Closure under products + inverses then puts all of `Γ'` inside
the arithmetic group `Sp_Ω(ℤ)` it is thin in.

### 4 — Zariski density: `𝔩 = ⟨N₀,…,N₅⟩ = 𝔰𝔭₆` (paper §2)

`N = T − I` is nilpotent (`N² = 0`, the unipotence that injects a tangent vector
into the Lie algebra of `Γ'`'s Zariski closure). The six conjugates
`Nᵢ = Ad(S)ⁱ N` all lie in `𝔰𝔭_Q` (so `𝔩 ⊆ 𝔰𝔭_Q`, dim ≤ 21), and the 6 generators +
their 15 pairwise brackets span dimension **21 = dim 𝔰𝔭₆** (exact integer rank). The
sandwich `21 ≤ dim 𝔩 ≤ 21` forces `𝔩 = 𝔰𝔭_Q`, so `Γ'` is Zariski-dense in Sp₆.

## What it establishes

Ping-pong (1–2) ⇒ `Γ'` is discrete of infinite index; symplectic (3) puts it inside
`Sp_Ω(ℤ)`; Zariski density (4) ⇒ it is not contained in any proper algebraic
subgroup. Infinite index + Zariski dense = **thin**.

This is *complementary* to `core/convex`'s check on the cone itself: core certifies
`K** = K` (the rays and facets are honest duals — see `NOTE-c32-facet-count.md`),
while this certifies the group's ping-pong *dynamics* on `K`.

## Files

```
verify.ts      the four checks (entry point; npm run verify-c32)
group.ts       buildHyperGroup (f,g → S, T⁻¹, E, P) + coneCertificateMaps
facets.ts      FACETS_H — the 77-row H-description K carries (over-complete; see the NOTE)
exactrank.ts   exact ℚ-rank of integer vectors (BigInt) — used for dim 𝔩
mat6.ts        local exact 6×6 integer matrix helpers (bespoke to this certificate)
```
