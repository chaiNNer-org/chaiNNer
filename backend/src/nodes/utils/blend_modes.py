import cv2
import numpy as np
import numpy.typing as npt

ndarray32 = npt.NDArray[np.float32]


class ImageBlender:
    """Class for compositing images using different blending modes."""

    def __init__(self):
        self.modes = {
            0: self.__normal,
            1: self.__multiply,
            2: self.__darken,
            3: self.__lighten,
            4: self.__add,
            5: self.__color_burn,
            6: self.__color_dodge,
            7: self.__reflect,
            8: self.__glow,
            9: self.__overlay,
            10: self.__difference,
            11: self.__negation,
            12: self.__screen,
            13: self.__xor,
        }

    def apply_blend(self, a: ndarray32, b: ndarray32, blend_mode: int) -> ndarray32:
        return self.modes[blend_mode](a, b)

    def __normal(self, a: ndarray32, b: ndarray32) -> ndarray32:
        return a

    def __multiply(self, a: ndarray32, b: ndarray32) -> ndarray32:
        return a * b

    def __darken(self, a: ndarray32, b: ndarray32) -> ndarray32:
        return np.minimum(a, b)

    def __lighten(self, a: ndarray32, b: ndarray32) -> ndarray32:
        return np.maximum(a, b)

    def __add(self, a: ndarray32, b: ndarray32) -> ndarray32:
        return a + b

    def __color_burn(self, a: ndarray32, b: ndarray32) -> ndarray32:
        return np.where(
            a == 0, 0, np.maximum(0, (1 - ((1 - b) / np.maximum(0.0001, a))))
        )

    def __color_dodge(self, a: ndarray32, b: ndarray32) -> ndarray32:
        return np.where(a == 1, 1, np.minimum(1, b / np.maximum(0.0001, (1 - a))))

    def __reflect(self, a: ndarray32, b: ndarray32) -> ndarray32:
        return np.where(a == 1, 1, np.minimum(1, b * b / np.maximum(0.0001, 1 - a)))

    def __glow(self, a: ndarray32, b: ndarray32) -> ndarray32:
        return np.where(b == 1, 1, np.minimum(1, a * a / np.maximum(0.0001, 1 - b)))

    def __overlay(self, a: ndarray32, b: ndarray32) -> ndarray32:
        return np.where(b < 0.5, (2 * b * a), (1 - (2 * (1 - b) * (1 - a))))

    def __difference(self, a: ndarray32, b: ndarray32) -> ndarray32:
        return cv2.absdiff(a, b)

    def __negation(self, a: ndarray32, b: ndarray32) -> ndarray32:
        return 1 - cv2.absdiff(cv2.absdiff(np.ones(b.shape, np.float32), b), a)

    def __screen(self, a: ndarray32, b: ndarray32) -> ndarray32:
        return a + b - (a * b)

    def __xor(self, a: ndarray32, b: ndarray32) -> ndarray32:
        return (
            np.bitwise_xor(
                (a * 255).astype(np.uint8), (b * 255).astype(np.uint8)
            ).astype(np.float32)
            / 255
        )
