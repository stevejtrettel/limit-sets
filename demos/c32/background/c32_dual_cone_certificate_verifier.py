"""Exact verifier for the proposed C-32 dual-cone ping-pong certificate.

This script starts from the original low-degree-first companion matrices A, B.
It constructs the rational u-basis, verifies the claimed normal forms for
B, T = B A^{-1}, and E = B P, and then checks the 77-inequality cone
certificate exactly over the rationals.

The core finite check is:

    K = { y in R^6 : H y >= 0 }
    G_i K subset K for i = 0,...,10,

where the G_i are the projective T^{-1}-branch maps in the u-basis.  We use
cdd.gmp to convert the H-representation to exact extremal rays and then test
all images of all extremal rays against H.
"""

from __future__ import annotations

from fractions import Fraction
import json

import cdd.gmp as cdd
from sympy import Matrix, eye, zeros


DIM = 6


def companion_matrix(coeffs):
    n = len(coeffs) - 1
    rows = [[0] * n for _ in range(n)]
    for i in range(1, n):
        rows[i][i - 1] = 1
    for i in range(n):
        rows[i][-1] = -coeffs[i]
    return Matrix(rows)


def mat_list(M):
    return [[int(M[i, j]) for j in range(M.cols)] for i in range(M.rows)]


def row_dot(row, vector):
    return sum(row[i] * vector[i] for i in range(DIM))


def mat_vec(M, vector):
    return tuple(sum(M[i][j] * vector[j] for j in range(DIM)) for i in range(DIM))


def mat_mul(A, B):
    return [
        [sum(A[i][k] * B[k][j] for k in range(DIM)) for j in range(DIM)]
        for i in range(DIM)
    ]


def mat_neg(A):
    return [[-x for x in row] for row in A]


def cdd_extreme_rays_from_H(H):
    inequalities = [
        [Fraction(0)] + [Fraction(x) for x in row]
        for row in H
    ]
    mat = cdd.matrix_from_array(inequalities, rep_type=cdd.RepType.INEQUALITY)
    poly = cdd.polyhedron_from_matrix(mat)
    generators = cdd.copy_generators(poly)
    rays = []
    lines = []
    lin_set = set(generators.lin_set)
    for idx, row in enumerate(generators.array):
        vector = tuple(Fraction(x) for x in row[1:])
        if idx in lin_set:
            lines.append(vector)
        elif any(vector):
            rays.append(vector)
    return rays, lines


def assert_equal(name, left, right):
    if left != right:
        raise AssertionError(f"{name} mismatch:\nleft={left}\nright={right}")


F_COEFFS = [1, -5, 11, -14, 11, -5, 1]
G_COEFFS = [1, 0, 0, 0, 0, 0, 1]

A = companion_matrix(F_COEFFS)
B = companion_matrix(G_COEFFS)
T = B * A.inv()
T_INV = T.inv()

P_REV = Matrix([[1 if i + j == DIM - 1 else 0 for j in range(DIM)] for i in range(DIM)])
E = B * P_REV

OMEGA = Matrix([
    [0, -13, -22, -25, -22, -13],
    [13, 0, -13, -22, -25, -22],
    [22, 13, 0, -13, -22, -25],
    [25, 22, 13, 0, -13, -22],
    [22, 25, 22, 13, 0, -13],
    [13, 22, 25, 22, 13, 0],
])


# u_i = (-1)^i B^i t0, where t0 spans Im(T-I).
e0 = Matrix([1, 0, 0, 0, 0, 0])
t0 = (T - eye(DIM)) * e0
U = Matrix.hstack(*[((-1) ** i) * (B ** i) * t0 for i in range(DIM)])
U_INV = U.inv()

B_U = U_INV * B * U
T_U = U_INV * T * U
T_INV_U = U_INV * T_INV * U
E_U = U_INV * E * U

EXPECTED_B_U = Matrix([
    [0, 0, 0, 0, 0, 1],
    [-1, 0, 0, 0, 0, 0],
    [0, -1, 0, 0, 0, 0],
    [0, 0, -1, 0, 0, 0],
    [0, 0, 0, -1, 0, 0],
    [0, 0, 0, 0, -1, 0],
])

EXPECTED_T_U = Matrix([
    [1, 5, 11, 14, 11, 5],
    [0, 1, 0, 0, 0, 0],
    [0, 0, 1, 0, 0, 0],
    [0, 0, 0, 1, 0, 0],
    [0, 0, 0, 0, 1, 0],
    [0, 0, 0, 0, 0, 1],
])

EXPECTED_T_INV_U = Matrix([
    [1, -5, -11, -14, -11, -5],
    [0, 1, 0, 0, 0, 0],
    [0, 0, 1, 0, 0, 0],
    [0, 0, 0, 1, 0, 0],
    [0, 0, 0, 0, 1, 0],
    [0, 0, 0, 0, 0, 1],
])

EXPECTED_E_U = Matrix([
    [1, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, -1],
    [0, 0, 0, 0, -1, 0],
    [0, 0, 0, -1, 0, 0],
    [0, 0, -1, 0, 0, 0],
    [0, -1, 0, 0, 0, 0],
])


H = [
    [1, -1, 0, 0, 0, 0],
    [187, 676, 1105, 1045, 556, 127],
    [17, 66, 113, 111, 62, 15],
    [1, 4, 7, 7, 4, 1],
    [6, 11, 14, 11, 5, 1],
    [259, 952, 1573, 1501, 808, 187],
    [19, 52, 73, 61, 29, 6],
    [343, 1276, 2125, 2041, 1108, 259],
    [43, 136, 205, 180, 89, 19],
    [439, 1648, 2761, 2665, 1456, 343],
    [79, 268, 422, 384, 196, 43],
    [127, 447, 722, 673, 352, 79],
    [1, 1, 0, 0, 0, 0],
    [11, 42, 71, 69, 38, 9],
    [4, 11, 14, 11, 5, 1],
    [9, 30, 45, 39, 19, 4],
    [15, 54, 87, 80, 41, 9],
    [21, 78, 130, 124, 66, 15],
    [27, 101, 170, 165, 90, 21],
    [1, 0, -1, 0, 0, 0],
    [5, 19, 32, 31, 17, 4],
    [1, 0, 1, 0, 0, 0],
    [1, 0, 0, -1, 0, 0],
    [1, 0, 0, 1, 0, 0],
    [9, 34, 57, 55, 30, 7],
    [1, 0, 0, 0, -1, 0],
    [4, 15, 25, 24, 13, 3],
    [1, 0, 0, 0, 1, 0],
    [1, 0, 0, 0, 0, -1],
    [1, 0, 0, 0, 0, 1],
    [7, 26, 43, 41, 22, 5],
    [0, -5, -11, -14, -11, -5],
    [4, -1, -5, -11, -14, -11],
    [21, 49, 67, 58, 31, 4],
    [56, 164, 236, 200, 101, 21],
    [10, 14, 11, 5, 1, -5],
    [36, 99, 135, 109, 55, 10],
    [81, 261, 395, 341, 170, 36],
    [10, 5, -1, -5, -11, -14],
    [45, 111, 145, 121, 64, 10],
    [114, 350, 509, 431, 215, 45],
    [220, 745, 1165, 1039, 525, 114],
    [13, 11, 5, 1, -5, -11],
    [54, 138, 181, 148, 76, 13],
    [132, 413, 608, 518, 257, 54],
    [4, 1, -5, -11, -14, -11],
    [19, 49, 67, 58, 31, 4],
    [46, 142, 208, 178, 91, 19],
    [88, 298, 466, 415, 211, 46],
    [4, 11, 14, 11, 5, -1],
    [9, 30, 45, 39, 21, 4],
    [15, 54, 87, 78, 41, 9],
    [21, 78, 132, 124, 66, 15],
    [259, -187, -808, -1501, -1573, -952],
    [19, -17, -70, -125, -127, -74],
    [343, -259, -1108, -2041, -2125, -1276],
    [43, -19, -89, -180, -205, -136],
    [439, -343, -1456, -2665, -2761, -1648],
    [79, -43, -196, -384, -422, -268],
    [268, 79, -43, -196, -384, -422],
    [547, -439, -1852, -3373, -3481, -2068],
    [127, -79, -352, -673, -722, -447],
    [13, -11, -46, -83, -85, -50],
    [9, -4, -19, -39, -45, -30],
    [15, -9, -41, -80, -87, -54],
    [54, 15, -9, -41, -80, -87],
    [36, -10, -55, -109, -135, -99],
    [81, -36, -170, -341, -395, -261],
    [496, 144, -81, -369, -721, -793],
    [114, -45, -215, -431, -509, -350],
    [132, -54, -257, -518, -608, -413],
    [88, -46, -211, -415, -466, -298],
    [9, -4, -21, -39, -45, -30],
    [15, -9, -41, -78, -87, -54],
    [54, 15, -9, -41, -78, -87],
    [21, -15, -66, -124, -132, -78],
    [78, 21, -15, -66, -124, -132],
]


DOMINANCE_ROWS = [
    [1, -1, 0, 0, 0, 0],
    [1, 1, 0, 0, 0, 0],
    [1, 0, -1, 0, 0, 0],
    [1, 0, 1, 0, 0, 0],
    [1, 0, 0, -1, 0, 0],
    [1, 0, 0, 1, 0, 0],
    [1, 0, 0, 0, -1, 0],
    [1, 0, 0, 0, 1, 0],
    [1, 0, 0, 0, 0, -1],
    [1, 0, 0, 0, 0, 1],
]


SEED_RAYS = [
    [1, 0, 0, 0, 0, 0],
    [5, -1, 0, 0, 0, 0],
    [11, 0, -1, 0, 0, 0],
    [14, 0, 0, -1, 0, 0],
    [11, 0, 0, 0, -1, 0],
    [5, 0, 0, 0, 0, -1],
]


def verify():
    if len(H) != 77:
        raise AssertionError(f"expected 77 H-rows, got {len(H)}")

    # Ambient integral alternating form in the original companion basis.
    assert_equal("A preserves Omega", A.T * OMEGA * A, OMEGA)
    assert_equal("B preserves Omega", B.T * OMEGA * B, OMEGA)
    if OMEGA.det() != 64:
        raise AssertionError(f"unexpected det(Omega)={OMEGA.det()}")

    # Normal form checks.
    if U.det() != -64:
        raise AssertionError(f"unexpected det(U)={U.det()}")
    assert_equal("B in u-basis", B_U, EXPECTED_B_U)
    assert_equal("T in u-basis", T_U, EXPECTED_T_U)
    assert_equal("T^{-1} in u-basis", T_INV_U, EXPECTED_T_INV_U)
    assert_equal("E in u-basis", E_U, EXPECTED_E_U)
    assert_equal("E^2", E_U * E_U, eye(DIM))
    assert_equal("E B E = B^{-1}", E_U * B_U * E_U, B_U.inv())
    assert_equal("E T E = T^{-1}", E_U * T_U * E_U, T_U.inv())

    # Dominance chamber inequalities are explicitly present among H rows.
    H_tuples = {tuple(row) for row in H}
    missing = [row for row in DOMINANCE_ROWS if tuple(row) not in H_tuples]
    if missing:
        raise AssertionError(f"missing dominance rows: {missing}")

    # Convert K to exact rays.  This also proves pointedness/no lineality.
    rays, lines = cdd_extreme_rays_from_H(H)
    if lines:
        raise AssertionError(f"K has lineality: {lines[:3]}")
    if not rays:
        raise AssertionError("K has no rays")

    # A canonical strict interior witness: sum of all exact extremal rays.
    interior = tuple(sum(ray[i] for ray in rays) for i in range(DIM))
    H_values = [row_dot(row, interior) for row in H]
    if min(H_values) <= 0:
        raise AssertionError(f"failed to find strict interior point, min={min(H_values)}")
    dominance_values = [row_dot(row, interior) for row in DOMINANCE_ROWS]
    if min(dominance_values) <= 0:
        raise AssertionError(f"interior not strictly in dominance chamber, min={min(dominance_values)}")

    # Seed cone C_- lies in K.
    seed_min = min(row_dot(row, ray) for row in H for ray in SEED_RAYS)
    if seed_min < 0:
        raise AssertionError(f"seed ray outside K, min={seed_min}")

    B_u = mat_list(B_U)
    T_inv_u = mat_list(T_INV_U)
    E_u = mat_list(E_U)
    B_powers = []
    current = [[1 if i == j else 0 for j in range(DIM)] for i in range(DIM)]
    for _ in range(6):
        B_powers.append(current)
        current = mat_mul(current, B_u)

    Gs = [
        ("T^-1", T_inv_u),
        ("T^-1 B", mat_mul(T_inv_u, B_powers[1])),
        ("T^-1 B E", mat_mul(mat_mul(T_inv_u, B_powers[1]), E_u)),
        ("-T^-1 B^2", mat_neg(mat_mul(T_inv_u, B_powers[2]))),
        ("-T^-1 B^2 E", mat_neg(mat_mul(mat_mul(T_inv_u, B_powers[2]), E_u))),
        ("T^-1 B^3", mat_mul(T_inv_u, B_powers[3])),
        ("T^-1 B^3 E", mat_mul(mat_mul(T_inv_u, B_powers[3]), E_u)),
        ("-T^-1 B^4", mat_neg(mat_mul(T_inv_u, B_powers[4]))),
        ("-T^-1 B^4 E", mat_neg(mat_mul(mat_mul(T_inv_u, B_powers[4]), E_u))),
        ("T^-1 B^5", mat_mul(T_inv_u, B_powers[5])),
        ("T^-1 B^5 E", mat_mul(mat_mul(T_inv_u, B_powers[5]), E_u)),
    ]

    branch_failures = []
    branch_minima = {}
    for name, G in Gs:
        min_value = None
        for ray_index, ray in enumerate(rays):
            image = mat_vec(G, ray)
            for row_index, row in enumerate(H):
                value = row_dot(row, image)
                min_value = value if min_value is None else min(min_value, value)
                if value < 0:
                    branch_failures.append((name, ray_index, row_index, str(value)))
                    break
            if branch_failures:
                break
        branch_minima[name] = str(min_value)
        if branch_failures:
            break
    if branch_failures:
        raise AssertionError(f"branch containment failed: {branch_failures[:1]}")

    return {
        "case": "C-32",
        "status": "verified exact dual-cone ping-pong certificate",
        "ambient_form_det": int(OMEGA.det()),
        "basis_det": int(U.det()),
        "t0": [int(x) for x in t0],
        "num_H_rows": len(H),
        "num_extreme_rays": len(rays),
        "num_lines": len(lines),
        "strict_interior_min_H": str(min(H_values)),
        "strict_interior_min_dominance": str(min(dominance_values)),
        "seed_min_HR": str(seed_min),
        "branch_maps_checked": len(Gs),
        "branch_minima": branch_minima,
        "ping_pong_conclusion": "projective group <Tbar,Bbar> is Z * C6; linear group is the central -I amalgam",
        "thinness_conclusion": "infinite index in the ambient arithmetic symplectic group Sp_Omega(Z)",
    }


if __name__ == "__main__":
    print(json.dumps(verify(), indent=2))
