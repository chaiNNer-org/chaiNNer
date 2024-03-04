import itertools

import numpy as np
from typing_extensions import override

from .noise_generator import NoiseGenerator


def smoothstep(t: np.ndarray):
    return t * t * (3 - 2 * t)


class ValueNoise(NoiseGenerator):
    def __init__(self, dimensions: int, seed: int, smooth: bool):
        self.dimensions = dimensions
        self.smooth = smooth

        self.values: np.ndarray = np.arange(16, dtype="float32")
        self.values = self.values / max(self.values)

        self.permutation_table = np.arange(self.values.size * 16)
        np.random.default_rng(seed).shuffle(self.permutation_table)

    @override
    def evaluate(self, points: np.ndarray):
        block, fractional = np.divmod(points, 1)
        if self.smooth:
            fractional = smoothstep(fractional)

        corners = np.zeros(
            (points.shape[0], 2**self.dimensions, self.dimensions), dtype="int32"
        )
        weights = np.zeros((points.shape[0], 2**self.dimensions))

        for i, pattern in enumerate(itertools.product([0, 1], repeat=self.dimensions)):
            np_pattern = np.array(pattern, dtype=np.int32)
            corners[:, i] = block + np_pattern

            # linear interpolation
            weights[:, i] = np.prod(
                fractional * np_pattern + (1 - fractional) * (1 - np_pattern), axis=1
            )

        value_index = np.zeros(corners.shape[:2], dtype="int32")
        for i in range(corners.shape[2]):
            value_index = (value_index + corners[:, :, i]) % self.permutation_table.size
            value_index = self.permutation_table[value_index]
        values = self.values[value_index % self.values.size]

        return np.sum(values * weights, axis=1)
