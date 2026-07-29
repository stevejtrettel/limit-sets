# allhalf-odd — the odd all-half tower

    Γ_d = ⟨ Comp((x−1)^d), Comp((x+1)^d) ⟩,   d ≥ 5 odd

One construction at every degree, drawn in RP^{d−1}. Unlike the other
hypergeometric viewers, there is no catalog to browse — the family is generated
from `d`, so the demo has a single group knob.

```sh
npm run dev allhalf-odd
node scripts/tests/all-half-odd-gates.ts
```

Family: [`src/examples/hypergeometric/all-half-odd.ts`](../../src/examples/hypergeometric/all-half-odd.ts).
Group tag for saved framings: `allhalf-odd`; example ids `allhalf-odd-d5` …
`allhalf-odd-d25` (stable — presets key off them).

## d = 5 is a picture you already have

At the bottom of the tower this is row **#48** of the Bajpai–Singh O(5) atlas —
the o5-explorer's own default group, "O(3,2) Case 1". The gates check that the
two agree point for point (49,150-point orbit, max deviation `0.00e+0`), so the
slider starts from known ground and walks up.

## Two things that are not like the other demos

**The seed word is hard-coded, on purpose.** Both generators are unipotent
(χ_A = (x−1)^d, χ_B = (x+1)^d), so every characteristic root is a d-fold root at
±1, and numeric root-finding scatters an m-fold root by ~ε^(1/m). The spurious
|λ| reported for the *unipotent* B climbs from 1.0006 at d=5 to 3.44 at d=15 —
past any usable `expand` floor — so `seedFromLoxodromic` would eventually certify
a parabolic as loxodromic. We use γ = B²T instead, which is proximal at every
degree (|λ| growing 39.9 → 1012 across d = 5…25) and whose trace is exactly
−d(2d−1), pinned by the gates.

**The chart menu adapts to the degree.** A coordinate chart drops every point
with |v_k| < `EPS_CHART`, and as d grows the limit set concentrates away from the
outer coordinate axes: by d = 17 the v₁ chart retains *none* of the orbit. Only
axes keeping ≥5% of the points are listed, with the share shown. At d = 25 that
leaves v₅…v₂₁ — the dead zone grows inward from both ends.

## The three frames

The chart menu offers three ways of looking, plus the surviving coordinate axes.

**auto-chart** — projective PCA on the companion-coordinate orbit. Retains 100%
of the orbit at every degree, but the picture *flattens* as `d` grows: the 3-D
spread goes from 85/11/4 at d=5 to 97/2/1 at d=25, i.e. one axis eats everything.

**Q-frame (standard signature)** — the geometric view, and the best one high in
the tower. The invariant form is congruence-diagonalized to diag(±1) exactly over
ℚ (see [`all-half-odd-normal-form.ts`](../../src/examples/hypergeometric/all-half-odd-normal-form.ts)),
and the chart is fitted in those whitened coordinates. Retains 97–100% at every
degree with a far more balanced spread (64/36/0 at d=25). At d=25 it shows a
radiating structure with clear Cantor gaps where the auto-chart shows a few flat
arcs.

**normal-form coords ψ = P⁻¹x** — the Levelt coordinates directly. Good at d = 5
and 7; from d ≈ 9 it retains only ~50% of the orbit and its spread degenerates
toward 100/0/0. Offered because it is the basis the draft argues in, not because
it is the best picture.

### Two frames that were tried and rejected

Worth recording, because both look like the obvious thing to do:

- **Raw wall pairings** φ_i = Q(·, v_i) with fixed indices. These are the paper's
  own quantities, but `b_d` grows fast enough that adjacent walls are nearly
  perfectly correlated: φ_{d−1} dominates and the ratios collapse. Measured 3-D
  spread was **100%/0%/0%** from d = 9 up — the limit set projects onto a *line*.
- **Normal-form coordinate axes** ψ_k used individually as chart denominators.
  After unit-normalizing the rows of P⁻¹, essentially no orbit point survives the
  chart-singular test beyond d ≈ 15 (0% retention at d = 17).

Both fail the same way: natural in the Q metric, wildly anisotropic in the
Euclidean one. Whitening by Q is the cure, and is exactly the "one more numerical
basis change that diagonalizes Q to a standard signature matrix" flagged as a
separate step in §14 of the root-level note.

### Still not fully comparable across d

The Q-frame fixes the *metric* canonically, but the final choice of which three
of the `d` directions to display is still a per-degree PCA fit. So the slider is
much closer to a genuine walk up the tower than it was, but consecutive degrees
are not yet frames of one animation.
