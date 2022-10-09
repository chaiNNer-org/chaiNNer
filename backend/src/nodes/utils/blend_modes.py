import cv2
import numpy as np


class BlendModes:
    """Blending mode constants"""

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
    SUBTRACT = 14
    DIVIDE = 15
    EXCLUSION = 16
    SOFT_LIGHT = 17
    HARD_LIGHT = 18
    VIVID_LIGHT = 19
    LINEAR_LIGHT = 20
    PIN_LIGHT = 21
    LINEAR_BURN = 22


__normalized = {
    BlendModes.NORMAL: True,
    BlendModes.MULTIPLY: True,
    BlendModes.DARKEN: True,
    BlendModes.LIGHTEN: True,
    BlendModes.ADD: False,
    BlendModes.COLOR_BURN: False,
    BlendModes.COLOR_DODGE: False,
    BlendModes.REFLECT: False,
    BlendModes.GLOW: False,
    BlendModes.OVERLAY: True,
    BlendModes.DIFFERENCE: True,
    BlendModes.NEGATION: True,
    BlendModes.SCREEN: True,
    BlendModes.XOR: True,
    BlendModes.SUBTRACT: False,
    BlendModes.DIVIDE: False,
    BlendModes.EXCLUSION: True,
    BlendModes.SOFT_LIGHT: True,
    BlendModes.HARD_LIGHT: True,
    BlendModes.VIVID_LIGHT: False,
    BlendModes.LINEAR_LIGHT: False,
    BlendModes.PIN_LIGHT: True,
    BlendModes.LINEAR_BURN: False,
}


def blend_mode_normalized(blend_mode: int) -> bool:
    """
    Returns whether the given blend mode is guaranteed to produce normalized results (value between 0 and 1).
    """
    return __normalized.get(blend_mode, False)


class ImageBlender:
    """Class for compositing images using different blending modes."""

    def __init__(self):
        self.modes = {
            BlendModes.NORMAL: self.__normal,
            BlendModes.MULTIPLY: self.__multiply,
            BlendModes.DARKEN: self.__darken,
            BlendModes.LIGHTEN: self.__lighten,
            BlendModes.ADD: self.__add,
            BlendModes.COLOR_BURN: self.__color_burn,
            BlendModes.COLOR_DODGE: self.__color_dodge,
            BlendModes.REFLECT: self.__reflect,
            BlendModes.GLOW: self.__glow,
            BlendModes.OVERLAY: self.__overlay,
            BlendModes.DIFFERENCE: self.__difference,
            BlendModes.NEGATION: self.__negation,
            BlendModes.SCREEN: self.__screen,
            BlendModes.XOR: self.__xor,
            BlendModes.SUBTRACT: self.__subtract,
            BlendModes.DIVIDE: self.__divide,
            BlendModes.EXCLUSION: self.__exclusion,
            BlendModes.SOFT_LIGHT: self.__soft_light,
            BlendModes.HARD_LIGHT: self.__hard_light,
            BlendModes.VIVID_LIGHT: self.__vivid_light,
            BlendModes.LINEAR_LIGHT: self.__linear_light,
            BlendModes.PIN_LIGHT: self.__pin_light,
            BlendModes.LINEAR_BURN: self.__linear_burn,
        }

    def apply_blend(self, a: np.ndarray, b: np.ndarray, blend_mode: int) -> np.ndarray:
        return self.modes[blend_mode](a, b)

    def __normal(self, a: np.ndarray, _: np.ndarray) -> np.ndarray:
        return a

    def __multiply(self, a: np.ndarray, b: np.ndarray) -> np.ndarray:
        return a * b

    def __darken(self, a: np.ndarray, b: np.ndarray) -> np.ndarray:
        return np.minimum(a, b)

    def __lighten(self, a: np.ndarray, b: np.ndarray) -> np.ndarray:
        return np.maximum(a, b)

    def __add(self, a: np.ndarray, b: np.ndarray) -> np.ndarray:
        return a + b

    def __color_burn(self, a: np.ndarray, b: np.ndarray) -> np.ndarray:
        return np.where(
            a == 0, 0, np.maximum(0, (1 - ((1 - b) / np.maximum(0.0001, a))))
        )

    def __color_dodge(self, a: np.ndarray, b: np.ndarray) -> np.ndarray:
        return np.where(a == 1, 1, np.minimum(1, b / np.maximum(0.0001, (1 - a))))

    def __reflect(self, a: np.ndarray, b: np.ndarray) -> np.ndarray:
        return np.where(a == 1, 1, np.minimum(1, b * b / np.maximum(0.0001, 1 - a)))

    def __glow(self, a: np.ndarray, b: np.ndarray) -> np.ndarray:
        return np.where(b == 1, 1, np.minimum(1, a * a / np.maximum(0.0001, 1 - b)))

    def __overlay(self, a: np.ndarray, b: np.ndarray) -> np.ndarray:
        return np.where(b < 0.5, 2 * b * a, 1 - 2 * (1 - b) * (1 - a))

    def __difference(self, a: np.ndarray, b: np.ndarray) -> np.ndarray:
        return cv2.absdiff(a, b)

    def __negation(self, a: np.ndarray, b: np.ndarray) -> np.ndarray:
        return 1 - cv2.absdiff(1 - b, a)

    def __screen(self, a: np.ndarray, b: np.ndarray) -> np.ndarray:
        return a + b - (a * b)  # type: ignore

    def __xor(self, a: np.ndarray, b: np.ndarray) -> np.ndarray:
        return (
            np.bitwise_xor(
                (a * 255).astype(np.uint8), (b * 255).astype(np.uint8)
            ).astype(np.float32)
            / 255
        )

    def __subtract(self, a: np.ndarray, b: np.ndarray) -> np.ndarray:
        return b - a  # type: ignore

    def __divide(self, a: np.ndarray, b: np.ndarray) -> np.ndarray:
        return b / np.maximum(0.0001, a)

    def __exclusion(self, a: np.ndarray, b: np.ndarray) -> np.ndarray:
        return a * (1 - b) + b * (1 - a)

    def __soft_light(self, a: np.ndarray, b: np.ndarray) -> np.ndarray:
        l = 2 * b * a + np.square(b) * (1 - 2 * a)
        h = np.sqrt(b) * (2 * a - 1) + 2 * b * (1 - a)
        return np.where(a <= 0.5, l, h)

    def __hard_light(self, a: np.ndarray, b: np.ndarray) -> np.ndarray:
        return np.where(a <= 0.5, 2 * a * b, 1 - 2 * (1 - a) * (1 - b))

    def __vivid_light(self, a: np.ndarray, b: np.ndarray) -> np.ndarray:
        return np.where(a <= 0.5, self.__color_burn(a, b), self.__color_dodge(a, b))

    def __linear_light(self, a: np.ndarray, b: np.ndarray) -> np.ndarray:
        return b + 2 * a - 1

    def __pin_light(self, a: np.ndarray, b: np.ndarray) -> np.ndarray:
        x = 2 * a
        y = x - 1
        return np.where(b < y, y, np.where(b > x, x, b))

    def __linear_burn(self, a: np.ndarray, b: np.ndarray) -> np.ndarray:
        return a + b - 1
