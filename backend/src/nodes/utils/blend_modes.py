from turtle import Screen
import cv2
import numpy as np
import numpy.typing as npt

ndarray32 = npt.NDArray[np.float32]


class ImageBlender:
    """Class for compositing images using different blending modes."""

    # Blend mode constants
    NORMAL = 0
    MULTIPLY = 1
    DARKEN = 2
    LIGHTEN = 3
    ADD = 4
    COLOR_BURN = 5
    COLOR_DODGE = 6
    REFLECT = 7
    GLOW = 8
    OVERLAY = 9
    DIFFERENCE = 10
    NEGATION = 11
    SCREEN = 12
    XOR = 13

    def __init__(self):
        self.modes = {
            self.NORMAL: self.__normal,
            self.MULTIPLY: self.__multiply,
            self.DARKEN: self.__darken,
            self.LIGHTEN: self.__lighten,
            self.ADD: self.__add,
            self.COLOR_BURN: self.__color_burn,
            self.COLOR_DODGE: self.__color_dodge,
            self.REFLECT: self.__reflect,
            self.GLOW: self.__glow,
            self.OVERLAY: self.__overlay,
            self.DIFFERENCE: self.__difference,
            self.NEGATION: self.__negation,
            self.SCREEN: self.__screen,
            self.XOR: self.__xor,
        }

    def apply_blend(self, a: ndarray32, b: ndarray32, blend_mode: int) -> ndarray32:
        return self.modes[blend_mode](a, b)

    def __normal(self, a: ndarray32, _: ndarray32) -> ndarray32:
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
