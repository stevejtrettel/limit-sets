# allhalf-even — the even all-half tower

    Γ_d = ⟨ Comp((x−1)^d), Comp((x+1)^d) ⟩,   d ≥ 4 even

The symplectic sibling of [`allhalf-odd`](../allhalf-odd/). Same defining
companion pair, generated from `d`; the parity of `d` changes the geometry.

```sh
npm run dev allhalf-even
node scripts/tests/all-half-even-gates.ts
```

Family: [`all-half-even.ts`](../../src/examples/hypergeometric/all-half-even.ts) ·
normal form: [`all-half-even-normal-form.ts`](../../src/examples/hypergeometric/all-half-even-normal-form.ts) ·
shared kernel: [`all-half-kernel.ts`](../../src/examples/hypergeometric/all-half-kernel.ts).
Group tag `allhalf-even`; ids `allhalf-even-d4` … `allhalf-even-d24` (stable).

## What the parity changes

|                     | odd d (orthogonal)          | even d (symplectic)           |
|---------------------|-----------------------------|-------------------------------|
| `T = G·F⁻¹`         | reflection, `T² = I`        | **transvection**, `T² ≠ I`    |
| invariant form      | symmetric (Toeplitz `b_d`)  | **alternating** (Toeplitz `a_d`) |
| projective group    | `(ℤ/2) ∗ ℤ`                 | **`F₂`**                      |
| walk                | free product, `2^N` tree    | **free `{A,A⁻¹,T,T⁻¹}`, `3^N`** |
| quadric             | limit set on `{Q = 0}`      | **none — `Ω(x,x) ≡ 0`**       |

Both towers draw on the *same* generating function `c_d(n) = [z^n]((1+z)/(1−z))^d`.
The only difference is how it is extended to negative `n` — evenly (`b_d(0) = 2`)
for the orthogonal tower, oddly (`a_d(0) = 0`) here. That single choice makes the
form symmetric or alternating, and everything else follows.

## Three things specific to this demo

**Depth costs more.** Four generators means a `3^N` non-backtracking tree against
the odd tower's `2^N`: `N = 10` is already 118k words. The slider tops out at 12
(≈1.06M).

**The alphabet uses the exact transvection inverse.** `(T−I)² = 0`, so
`T⁻¹ = 2I − T` exactly — the one place this family avoids floating-point matrix
inversion entirely. The gates check `T·(2I−T) = I` in integers.

**The seed word is hard-coded**, as in the odd tower and for the same reason:
both generators are unipotent, so every characteristic root is a `d`-fold root at
`±1` and numeric root-finding scatters it (the spurious `|λ|` reported for `A`
reaches 2.9 by `d = 24`). We use `γ = T⁻¹A`, proximal at every degree tested
(`d = 4…30`, `|λ|` growing 11.6 → 86.6, drift ≤ 1e-16). Its trace is exactly
`3d`, which the gates pin — and which also certifies non-unipotence, since a
±unipotent `d×d` matrix has trace `±d`.

## Charts

**auto-chart** (projective PCA) and **normal-form coords `ψ = P⁻¹x`**, plus the
coordinate axes that retain ≥5% of the orbit.

There is deliberately **no Q-frame** here. The odd tower's Q-frame comes from
congruence-diagonalizing its *symmetric* form to `diag(±1)` — canonical, because
the signature is an invariant. An alternating form has no such invariant: every
full-rank symplectic form is equivalent to the standard one and `Sp(d,ℝ)` acts
transitively on Darboux frames, so a "symplectic frame" would be an arbitrary
choice carrying no more information than the plain auto-chart.

The normal-form chart degrades with `d` the same way it does in the odd tower —
by `d = 24` it projects the limit set close to a line. Use the auto-chart high in
the tower.

## Where the picture is best

`d = 4` — the lowest ambient dimension in either tower (RP³), and the richest
picture: visible cusp fans and radiating arcs. Both generators are parabolic, so
those fans are real structure, not artifacts.
