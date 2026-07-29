Gre# Even All-Half Groups: Minimal Limit-Set Implementation

## Goal

For every even integer

\[
d=4,6,8,\ldots,
\]

construct explicit matrices for the even all-half group and use their
projective action to make limit-set experiments.

There are two useful coordinate systems:

1. **companion coordinates**, with the original generators \(F_d,G_d\);
2. **normal coordinates**, with a regular unipotent \(A\) and a symplectic
   transvection \(T\).

They describe conjugate projective actions. For a first renderer, normal
coordinates are usually more geometric, while companion coordinates are the
simplest direct transcription of the original definition.

Throughout, vectors are columns and indices run from \(0\) through \(d-1\).

---

## 1. Original companion generators

Define

\[
F_d=\operatorname{Comp}((x-1)^d),
\qquad
G_d=\operatorname{Comp}((x+1)^d).
\]

Both matrices have \(1\)'s immediately below the diagonal. Their only other
nonzero entries are in the final column:

\[
\boxed{
(F_d)_{ij}=
\begin{cases}
1,&i=j+1,\\
(-1)^{i+1}\binom di,&j=d-1,\\
0,&\text{otherwise},
\end{cases}
}
\]

\[
\boxed{
(G_d)_{ij}=
\begin{cases}
1,&i=j+1,\\
-\binom di,&j=d-1,\\
0,&\text{otherwise}.
\end{cases}
}
\]

Thus \(F_d\) has an alternating Pascal-triangle column beginning negative,
while \(G_d\) has an all-negative Pascal column.

### Pseudocode

```text
function companionGenerators(d):
    require d >= 4
    require d is even

    F = zeroMatrix(d, d)
    G = zeroMatrix(d, d)

    for i from 0 to d - 2:
        F[i + 1, i] = 1
        G[i + 1, i] = 1

    for i from 0 to d - 1:
        p = binomial(d, i)
        F[i, d - 1] = (-1)^(i + 1) * p
        G[i, d - 1] = -p

    return F, G
```

The original group is

\[
\Gamma_d=\langle F_d,G_d\rangle.
\]

---

## 2. Normal generators \(A,T\)

The normal form uses

\[
\boxed{A=F_d}
\]

as a numerical matrix, together with a rank-one symplectic transvection \(T\).

First define

\[
c_d(n)
=
[z^n]\left(\frac{1+z}{1-z}\right)^d.
\]

For implementation,

\[
\boxed{
c_d(n)
=
\sum_{k=0}^{\min(d,n)}
\binom dk
\binom{d+n-k-1}{n-k}.
}
\]

Then

\[
\boxed{
T=
\begin{pmatrix}
1&-c_d(1)&-c_d(2)&\cdots&-c_d(d-1)\\
0&1&0&\cdots&0\\
0&0&1&\cdots&0\\
\vdots&&&\ddots&\\
0&0&0&\cdots&1
\end{pmatrix}.
}
\]

Only the first row differs from the identity.

The second normal-form companion generator is

\[
\boxed{B=TA.}
\]

Therefore

\[
\langle A,B\rangle=\langle A,T\rangle.
\]

The paper proves that this group is free:

\[
\langle A,T\rangle\cong F_2.
\]

### Pseudocode

```text
function coefficientC(d, n):
    total = 0

    for k from 0 to min(d, n):
        total += binomial(d, k)
                 * binomial(d + n - k - 1, n - k)

    return total

function normalGenerators(d):
    F, unusedG = companionGenerators(d)
    A = F

    T = identityMatrix(d)

    for j from 1 to d - 1:
        T[0, j] = -coefficientC(d, j)

    B = T * A
    return A, T, B
```

The transvection has a particularly easy inverse. If

\[
N=T-I,
\]

then

\[
N^2=0
\]

and hence

\[
\boxed{T^{-1}=I-N=2I-T.}
\]

More generally,

\[
T^m=I+mN.
\]

---

## 3. The preserved alternating form

The projective action can be rendered without explicitly using the form, but
the form is useful for validation and for later symplectic flag geometry.

Extend \(c_d\) to an odd function \(a_d:\mathbb Z\to\mathbb Z\):

\[
a_d(0)=0,
\]

\[
a_d(n)=c_d(n)\quad(n>0),
\]

\[
a_d(-n)=-c_d(n)\quad(n>0).
\]

Define

\[
\boxed{\Omega_{ij}=a_d(j-i).}
\]

Thus

\[
\Omega=
\begin{pmatrix}
0&c_d(1)&c_d(2)&\cdots\\
-c_d(1)&0&c_d(1)&\cdots\\
-c_d(2)&-c_d(1)&0&\cdots\\
\vdots&\vdots&\vdots&\ddots
\end{pmatrix}.
\]

The matrices satisfy

\[
A^T\Omega A=\Omega,
\qquad
T^T\Omega T=\Omega,
\qquad
B^T\Omega B=\Omega.
\]

### Pseudocode

```text
function oddKernel(d, n):
    if n == 0:
        return 0

    if n > 0:
        return coefficientC(d, n)

    return -coefficientC(d, -n)

function alternatingForm(d):
    Omega = zeroMatrix(d, d)

    for i from 0 to d - 1:
        for j from 0 to d - 1:
            Omega[i, j] = oddKernel(d, j - i)

    return Omega
```

Important: unlike the odd-dimensional orthogonal family, \(\Omega\) does not
define a null quadric. Every vector satisfies

\[
\Omega(x,x)=0.
\]

So the first limit-set experiment should use the action on projective space
\(\mathbb{RP}^{d-1}\), not a quadratic boundary.

---

## 4. Change from normal to companion coordinates

This section is optional if the renderer uses only \(A,T\), but it lets one
translate pictures between the two representations.

Let

\[
u=(G_d-F_d)e_{d-1}.
\]

Its entries are

\[
\boxed{
u_i=
\begin{cases}
0,&i\text{ even},\\
-2\binom di,&i\text{ odd}.
\end{cases}
}
\]

Form

\[
\boxed{
P=[u\;\;F_du\;\;F_d^2u\;\;\cdots\;\;F_d^{d-1}u].
}
\]

The coordinate direction is

\[
\boxed{x_{\mathrm{comp}}=Px_{\mathrm{normal}}.}
\]

Therefore

\[
A=P^{-1}F_dP,
\]

\[
B=P^{-1}G_dP,
\]

and

\[
\boxed{
T=P^{-1}G_dF_d^{-1}P.
}
\]

### Pseudocode

```text
function normalToCompanionBasis(F, G):
    d = numberOfRows(F)
    u = column(G, d - 1) - column(F, d - 1)

    P = zeroMatrix(d, d)
    v = u

    for j from 0 to d - 1:
        setColumn(P, j, v)
        v = F * v

    require determinant(P) != 0
    return P
```

If vectors are stored in companion coordinates, the preserved form is

\[
\boxed{
\Omega_{\mathrm{comp}}
=
P^{-T}\Omega P^{-1}.
}
\]

Do not use \(\Omega\) to pair companion-coordinate vectors.

---

## 5. Complete \(d=4\) reference matrices

For \(d=4\),

\[
F_4=
\begin{pmatrix}
0&0&0&-1\\
1&0&0&4\\
0&1&0&-6\\
0&0&1&4
\end{pmatrix},
\]

\[
G_4=
\begin{pmatrix}
0&0&0&-1\\
1&0&0&-4\\
0&1&0&-6\\
0&0&1&-4
\end{pmatrix}.
\]

The kernel coefficients are

\[
c_4(1)=8,\qquad c_4(2)=32,\qquad c_4(3)=88.
\]

Therefore

\[
T=
\begin{pmatrix}
1&-8&-32&-88\\
0&1&0&0\\
0&0&1&0\\
0&0&0&1
\end{pmatrix},
\]

and

\[
\Omega=
\begin{pmatrix}
0&8&32&88\\
-8&0&8&32\\
-32&-8&0&8\\
-88&-32&-8&0
\end{pmatrix}.
\]

The change-of-basis vector is

\[
u=
\begin{pmatrix}
0\\-8\\0\\-8
\end{pmatrix},
\]

and

\[
P=
\begin{pmatrix}
0&8&32&88\\
-8&-32&-120&-320\\
0&40&160&408\\
-8&-32&-88&-192
\end{pmatrix}.
\]

These values make a useful unit-test fixture.

---

## 6. Projective normalization

The matrices act on projective space, so nonzero scalar multiples of a vector
represent the same point.

After every matrix multiplication, normalize:

```text
function normalizeProjective(v):
    v = v / euclideanNorm(v)

    # Choose one representative of the antipodal pair.
    for i from 0 to dimension(v) - 1:
        if abs(v[i]) > epsilon:
            if v[i] < 0:
                v = -v
            break

    return v
```

Renormalizing after every multiplication prevents overflow. It is essential
because products of these integer matrices grow rapidly.

---

## 7. Sampling points for a first limit-set renderer

The generators \(A\) and \(T\) are unipotent. They are not contractions, so
one should not treat

\[
\{A,A^{-1},T,T^{-1}\}
\]

as an ordinary contracting iterated-function system.

A practical first approximation is to sample attracting eigenlines of many
reduced group words.

### Recommended algorithm

1. Generate many reduced words in
   \[
   A,\ A^{-1},\ T,\ T^{-1}.
   \]
2. Form the corresponding matrix \(W\), renormalizing the matrix occasionally.
3. Compute the eigenvalues of \(W\).
4. Sort them by absolute value:
   \[
   |\lambda_1|\geq|\lambda_2|\geq\cdots.
   \]
5. If
   \[
   |\lambda_1|>(1+\varepsilon)|\lambda_2|,
   \]
   regard \(W\) as numerically proximal.
6. Take an eigenvector \(v_1\) for \(\lambda_1\).
7. Normalize its projective class and plot it.

```text
function sampleAttractingLines(generators, maxWordLength):
    points = []

    for W in reducedWords(generators, maxWordLength):
        eigenvalues, eigenvectors = eigensystem(W)
        orderByDecreasingAbsoluteEigenvalue(eigenvalues, eigenvectors)

        if abs(eigenvalues[0])
           > (1 + spectralGapTolerance) * abs(eigenvalues[1]):

            v = normalizeProjective(eigenvectors[0])
            points.push(v)

    return points
```

Random long reduced words can replace exhaustive word enumeration once the
basic implementation works.

### Reduced-word rule

Do not append a generator immediately after its inverse:

```text
A     cannot be followed by AInverse
AInv  cannot be followed by A
T     cannot be followed by TInverse
TInv  cannot be followed by T
```

Powers such as \(AA\) or \(TT\) are allowed.

---

## 8. Projecting \(\mathbb{RP}^{d-1}\) for display

The computed limit-set samples live in \(\mathbb{RP}^{d-1}\), not inherently
in a two-dimensional plane.

For a first implementation:

- normalize all projective vectors to the unit sphere \(S^{d-1}\);
- identify antipodal representatives using the sign convention above;
- choose a fixed linear projection to \(\mathbb R^2\) or \(\mathbb R^3\);
- optionally compute PCA from the sampled point cloud and display the leading
  two or three components.

For \(d=4\), the points lie in \(\mathbb{RP}^3\), so a three-dimensional
point-cloud view is natural. A two-dimensional image can then use an ordinary
3D camera.

Changing from normal to companion coordinates applies the projective
transformation

\[
[x]\longmapsto[Px].
\]

Thus the two coordinate systems display projectively equivalent, but visually
different, versions of the same limit set.

---

## 9. Minimal construction pipeline

```text
function buildEvenAllHalfLimitSetData(d):
    require d >= 4
    require d is even

    # Original representation.
    F, G = companionGenerators(d)

    # Preferred normal representation.
    A, T, B = normalGenerators(d)
    AInv = inverse(A)
    TInv = 2 * identityMatrix(d) - T

    # Preserved form, primarily for validation.
    Omega = alternatingForm(d)

    # Optional coordinate conversion.
    P = normalToCompanionBasis(F, G)
    PInv = inverse(P)
    OmegaComp = transpose(PInv) * Omega * PInv

    # Required checks.
    assert B == T * A
    assert rank(T - identityMatrix(d)) == 1
    assert (T - identityMatrix(d))^2 == zeroMatrix(d, d)

    assert transpose(A) * Omega * A == Omega
    assert transpose(T) * Omega * T == Omega

    assert inverse(P) * F * P == A
    assert inverse(P) * G * P == B

    return {
        wordGenerators: {
            A,
            AInverse: AInv,
            T,
            TInverse: TInv
        },

        normalCoordinates: {
            Omega
        },

        companionCoordinates: {
            F,
            G,
            Omega: OmegaComp
        },

        coordinateChange: {
            normalToCompanion: P,
            companionToNormal: PInv
        }
    }
```

The smallest useful renderer needs only:

1. `A`, `AInverse`, `T`, and `TInverse`;
2. reduced-word generation;
3. dominant-eigenline extraction;
4. projective normalization;
5. a chosen 2D or 3D projection.

The matrices \(P\), \(\Omega\), and \(\Omega_{\mathrm{comp}}\) are important
for verification and geometric interpretation, but are not required merely to
generate a first projective point cloud.

