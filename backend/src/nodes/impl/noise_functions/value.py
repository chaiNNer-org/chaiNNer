import itertools

import numpy as np


class ValueNoise:
    def __init__(self, dimensions: int, seed: int):
        self.dimensions = dimensions

        self.values = np.arange(16, dtype="float32")
        self.values = self.values / max(self.values)

        np.random.seed(seed)
        self.permutation_table = np.arange(self.values.size * 16)
        np.random.shuffle(self.permutation_table)

    def evaluate(self, points: np.ndarray):
        block, fractional = np.divmod(points, 1)

        corners = np.zeros(
            (points.shape[0], 2**self.dimensions, self.dimensions), dtype="int32"
        )
        weights = np.zeros((points.shape[0], 2**self.dimensions))

        for i, pattern in enumerate(itertools.product([0, 1], repeat=self.dimensions)):
            pattern = np.array(pattern, dtype=np.int32)  # noqa
            corners[:, i] = block + pattern

            # linear interpolation
            weights[:, i] = np.prod(
                fractional * pattern + (1 - fractional) * (1 - pattern), axis=1
            )

        value_index = np.zeros(corners.shape[:2], dtype="int32")
        for i in range(corners.shape[2]):
            value_index = (value_index + corners[:, :, i]) % self.permutation_table.size
            value_index = self.permutation_table[value_index]
        values = self.values[value_index % self.values.size]

        return np.sum(values * weights, axis=1)
