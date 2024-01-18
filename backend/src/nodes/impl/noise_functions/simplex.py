"""
Simplex noise implementation by Alex Dodge, 2023

References:

Simplex noise demystified, Stefan Gustavson (2005)
http://staffwww.itn.liu.se/~stegu/simplexnoise/simplexnoise.pdf
"""

from __future__ import annotations

import itertools

import numpy as np

# fmt: off
PERMUTATION_TABLE_ARRAY = np.array([
    151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225, 140, 36, 103,
    30, 69, 142, 8, 99, 37, 240, 21, 10, 23, 190, 6, 148, 247, 120, 234, 75, 0, 26, 197,
    62, 94, 252, 219, 203, 117, 35, 11, 32, 57, 177, 33, 88, 237, 149, 56, 87, 174, 20,
    125, 136, 171, 168, 68, 175, 74, 165, 71, 134, 139, 48, 27, 166, 77, 146, 158, 231,
    83, 111, 229, 122, 60, 211, 133, 230, 220, 105, 92, 41, 55, 46, 245, 40, 244, 102, 143,
    54, 65, 25, 63, 161, 1, 216, 80, 73, 209, 76, 132, 187, 208, 89, 18, 169, 200, 196,
    135, 130, 116, 188, 159, 86, 164, 100, 109, 198, 173, 186, 3, 64, 52, 217, 226, 250,
    124, 123, 5, 202, 38, 147, 118, 126, 255, 82, 85, 212, 207, 206, 59, 227, 47, 16, 58,
    17, 182, 189, 28, 42, 223, 183, 170, 213, 119, 248, 152, 2, 44, 154, 163, 70, 221,
    153, 101, 155, 167, 43, 172, 9, 129, 22, 39, 253, 19, 98, 108, 110, 79, 113, 224,
    232, 178, 185, 112, 104, 218, 246, 97, 228, 251, 34, 242, 193, 238, 210, 144, 12, 191,
    179, 162, 241, 81, 51, 145, 235, 249, 14, 239, 107, 49, 192, 214, 31, 181, 199, 106,
    157, 184, 84, 204, 176, 115, 121, 50, 45, 127, 4, 150, 254, 138, 236, 205, 93, 222,
    114, 67, 29, 24, 72, 243, 141, 128, 195, 78, 66, 215, 61, 156, 180
], dtype=np.int32)
# fmt: on

# Empirically determined scaling factor for different numbers of dimensions
SCALE = {
    2: 50,
    3: 39,
    4: 32,
    5: 28,
    6: 26,
    # It looks terrible at this many dimensions anyway
}


class SimplexNoise:
    def __init__(self, dimensions: int, seed: int | None, r2: float = 0.5):
        if dimensions <= 0:
            raise ValueError
        if dimensions == 1:
            raise RuntimeError("1D Simplex noise is not implemented here.")
        if dimensions > 6:
            raise RuntimeError("7D+ Simplex noise is not implemented here.")

        self.dimensions = dimensions
        self.r2 = r2
        self.F = (np.sqrt(self.dimensions + 1) - 1) / self.dimensions
        self.G = (1 - 1 / np.sqrt(self.dimensions + 1)) / self.dimensions

        """
        For 2D noise, we pick 16 gradients evenly distributed around the unit circle.
        For 3D and above, we pick gradients pointing at the midpoints of the edges of a hypercube centered on the origin
        """

        if self.dimensions == 2:
            n_gradients = 16
            self.gradients = np.array(
                [
                    (
                        np.cos(2 * np.pi * i / n_gradients),
                        np.sin(2 * np.pi * i / n_gradients),
                    )
                    for i in range(n_gradients)
                ]
            )
        else:
            n_gradients = self.dimensions * 2 ** (self.dimensions - 1)
            self.gradients = np.zeros((n_gradients, self.dimensions))
            for zero_dim in range(self.dimensions):
                for i, vec in enumerate(
                    itertools.product([-1, 1], repeat=self.dimensions - 1)
                ):
                    idx = zero_dim * 2 ** (self.dimensions - 1) + i
                    self.gradients[idx, :zero_dim] = vec[:zero_dim]
                    self.gradients[idx, zero_dim + 1 :] = vec[zero_dim:]

        if seed is None:
            # Use the canonical table from the reference implementation
            self.permutation_table = PERMUTATION_TABLE_ARRAY
        else:
            self.permutation_table = np.arange(self.gradients.shape[0] * 16)
            np.random.default_rng(seed).shuffle(self.permutation_table)

    def evaluate(self, points: np.ndarray):
        n_points = points.shape[0]
        if points.shape != (n_points, self.dimensions):
            raise ValueError("points.shape must be equal to (n_points, dimensions)")

        skewed_points = points + (points.sum(axis=1) * self.F).reshape((n_points, 1))
        skewed_bases, skewed_points_remainder = np.divmod(skewed_points, 1)

        skewed_simplex_verts = np.full(
            (n_points, self.dimensions + 1, self.dimensions),
            fill_value=skewed_bases.reshape((n_points, 1, -1)),
            dtype="int32",
        )

        skewed_simplex_verts[:, self.dimensions, :] += 1
        for i in range(1, self.dimensions):
            largest_dimension = np.argmax(skewed_points_remainder, axis=1)
            for o in range(self.dimensions):
                skewed_simplex_verts[
                    (largest_dimension == o), i : self.dimensions, o
                ] += 1
                if i != self.dimensions - 1:
                    skewed_points_remainder[(largest_dimension == o), o] = -1

        gradient_index = np.zeros(skewed_simplex_verts.shape[:2], dtype="int32")
        for i in range(skewed_simplex_verts.shape[2]):
            gradient_index = (
                gradient_index + skewed_simplex_verts[:, :, i]
            ) % self.permutation_table.size
            gradient_index = self.permutation_table[gradient_index]
        gradients = self.gradients[gradient_index % self.gradients.shape[0]]

        simplex_verts = (
            skewed_simplex_verts
            - skewed_simplex_verts.sum(axis=2).reshape((n_points, -1, 1)) * self.G
        )
        displacement = np.power(
            points.reshape((n_points, 1, -1)) - simplex_verts, 2
        ).sum(axis=2)
        dot_gradient = np.sum(
            (points.reshape((n_points, 1, -1)) - simplex_verts) * gradients, axis=2
        )
        contributions = (
            np.power(np.maximum(0, self.r2 - displacement), 4) * dot_gradient
        )

        return np.sum(contributions, axis=1) * SCALE[self.dimensions] + 0.5
