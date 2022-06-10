import cv2
import numpy as np
import numpy.typing as npt

ndarray32 = npt.NDArray[np.float32]


class BlendMode:
    def __init__(self):
        self.modes = {
            0: self.normal,
            1: self.multiply,
            2: self.darken,
            3: self.lighten,
            4: self.add,
            5: self.color_burn,
            6: self.color_dodge,
            7: self.reflect,
            8: self.glow,
            9: self.overlay,
            10: self.difference,
            11: self.negation,
            12: self.screen,
            13: self.xor,
        }

    def apply_blend(self, a: ndarray32, b: ndarray32, blend_mode: int) -> ndarray32:
        return self.modes[blend_mode](a, b)

    def normal(self, a: ndarray32, b: ndarray32) -> ndarray32:
        return a

    def multiply(self, a: ndarray32, b: ndarray32) -> ndarray32:
        return a * b

    def darken(self, a: ndarray32, b: ndarray32) -> ndarray32:
        return np.minimum(a, b)

    def lighten(self, a: ndarray32, b: ndarray32) -> ndarray32:
        return np.maximum(a, b)

    def add(self, a: ndarray32, b: ndarray32) -> ndarray32:
        return a + b

    def color_burn(self, a: ndarray32, b: ndarray32) -> ndarray32:
        return np.where(
            a == 0, 0, np.maximum(0, (1 - ((1 - b) / np.maximum(0.0001, a))))
        )

    def color_dodge(self, a: ndarray32, b: ndarray32) -> ndarray32:
        return np.where(a == 1, 1, np.minimum(1, b / np.maximum(0.0001, (1 - a))))

    def reflect(self, a: ndarray32, b: ndarray32) -> ndarray32:
        return np.where(a == 1, 1, np.minimum(1, b * b / np.maximum(0.0001, 1 - a)))

    def glow(self, a: ndarray32, b: ndarray32) -> ndarray32:
        return np.where(b == 1, 1, np.minimum(1, a * a / np.maximum(0.0001, 1 - b)))

    def overlay(self, a: ndarray32, b: ndarray32) -> ndarray32:
        return np.where(b < 0.5, (2 * b * a), (1 - (2 * (1 - b) * (1 - a))))

    def difference(self, a: ndarray32, b: ndarray32) -> ndarray32:
        return cv2.absdiff(a, b)

    def negation(self, a: ndarray32, b: ndarray32) -> ndarray32:
        return 1 - cv2.absdiff(cv2.absdiff(np.ones(b.shape, np.float32), b), a)

    def screen(self, a: ndarray32, b: ndarray32) -> ndarray32:
        return a + b - (a * b)

    def xor(self, a: ndarray32, b: ndarray32) -> ndarray32:
        return (
            np.bitwise_xor(
                (a * 255).astype(np.uint8), (b * 255).astype(np.uint8)
            ).astype(np.float32)
            / 255
        )
