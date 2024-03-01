from abc import ABC, abstractmethod

import numpy as np


class NoiseGenerator(ABC):
    @abstractmethod
    def evaluate(self, points: np.ndarray) -> np.ndarray:
        ...
