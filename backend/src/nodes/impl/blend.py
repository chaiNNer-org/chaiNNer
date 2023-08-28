from enum import Enum

import cv2
import numpy as np

from ..utils.utils import get_h_w_c
from .image_utils import as_target_channels, normalize, to_uint8


class BlendMode(Enum):
    NORMAL = 0
    DARKEN = 2
    MULTIPLY = 1
    COLOR_BURN = 5
    LINEAR_BURN = 22
    LIGHTEN = 3
    SCREEN = 12
    COLOR_DODGE = 6
    ADD = 4
    OVERLAY = 9
    SOFT_LIGHT = 17
    HARD_LIGHT = 18
    VIVID_LIGHT = 19
    LINEAR_LIGHT = 20
    PIN_LIGHT = 21
    REFLECT = 7
    GLOW = 8
    DIFFERENCE = 10
    EXCLUSION = 16
    NEGATION = 11
    SUBTRACT = 14
    DIVIDE = 15
    XOR = 13


__normalized = {
    BlendMode.NORMAL: True,
    BlendMode.MULTIPLY: True,
    BlendMode.DARKEN: True,
    BlendMode.LIGHTEN: True,
    BlendMode.ADD: False,
    BlendMode.COLOR_BURN: False,
    BlendMode.COLOR_DODGE: False,
    BlendMode.REFLECT: False,
    BlendMode.GLOW: False,
    BlendMode.OVERLAY: True,
    BlendMode.DIFFERENCE: True,
    BlendMode.NEGATION: True,
    BlendMode.SCREEN: True,
    BlendMode.XOR: True,
    BlendMode.SUBTRACT: False,
    BlendMode.DIVIDE: False,
    BlendMode.EXCLUSION: True,
    BlendMode.SOFT_LIGHT: True,
    BlendMode.HARD_LIGHT: True,
    BlendMode.VIVID_LIGHT: False,
    BlendMode.LINEAR_LIGHT: False,
    BlendMode.PIN_LIGHT: True,
    BlendMode.LINEAR_BURN: False,
}


def blend_mode_normalized(blend_mode: BlendMode) -> bool:
    """
    Returns whether the given blend mode is guaranteed to produce normalized results (value between 0 and 1).
    """
    return __normalized.get(blend_mode, False)


class ImageBlender:
    """Class for compositing images using different blending modes."""

    def __init__(self):
        self.modes = {
            BlendMode.NORMAL: self.__normal,
            BlendMode.MULTIPLY: self.__multiply,
            BlendMode.DARKEN: self.__darken,
            BlendMode.LIGHTEN: self.__lighten,
            BlendMode.ADD: self.__add,
            BlendMode.COLOR_BURN: self.__color_burn,
            BlendMode.COLOR_DODGE: self.__color_dodge,
            BlendMode.REFLECT: self.__reflect,
            BlendMode.GLOW: self.__glow,
            BlendMode.OVERLAY: self.__overlay,
            BlendMode.DIFFERENCE: self.__difference,
            BlendMode.NEGATION: self.__negation,
            BlendMode.SCREEN: self.__screen,
            BlendMode.XOR: self.__xor,
            BlendMode.SUBTRACT: self.__subtract,
            BlendMode.DIVIDE: self.__divide,
            BlendMode.EXCLUSION: self.__exclusion,
            BlendMode.SOFT_LIGHT: self.__soft_light,
            BlendMode.HARD_LIGHT: self.__hard_light,
            BlendMode.VIVID_LIGHT: self.__vivid_light,
            BlendMode.LINEAR_LIGHT: self.__linear_light,
            BlendMode.PIN_LIGHT: self.__pin_light,
            BlendMode.LINEAR_BURN: self.__linear_burn,
        }

    def apply_blend(
        self, a: np.ndarray, b: np.ndarray, blend_mode: BlendMode
    ) -> np.ndarray:
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
        return np.asarray(cv2.absdiff(a, b))

    def __negation(self, a: np.ndarray, b: np.ndarray) -> np.ndarray:
        return 1 - cv2.absdiff(1 - b, a))  # type: ignore

    def __screen(self, a: np.ndarray, b: np.ndarray) -> np.ndarray:
        return a + b - (a * b)  # type: ignore

    def __xor(self, a: np.ndarray, b: np.ndarray) -> np.ndarray:
        return normalize(
            np.bitwise_xor(to_uint8(a, normalized=True), to_uint8(b, normalized=True))
        )

    def __subtract(self, a: np.ndarray, b: np.ndarray) -> np.ndarray:
        return b - a

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


def blend_images(overlay: np.ndarray, base: np.ndarray, blend_mode: BlendMode):
    """
    Changes the given image to the background overlayed with the image.

    The 2 given images must be the same size and their values must be between 0 and 1.

    The returned image is guaranteed to have values between 0 and 1.

    If the 2 given images have a different number of channels, then the returned image
    will have maximum of the two.

    Only grayscale, RGB, and RGBA images are supported.
    """
    o_shape = get_h_w_c(overlay)
    b_shape = get_h_w_c(base)

    assert (
        o_shape[:2] == b_shape[:2]
    ), "The overlay and the base image must have the same size"

    def assert_sane(c: int, name: str):
        sane = c in (1, 3, 4)
        assert sane, f"The {name} has to be a grayscale, RGB, or RGBA image"

    o_channels = o_shape[2]
    b_channels = b_shape[2]

    assert_sane(o_channels, "overlay layer")
    assert_sane(b_channels, "base layer")

    blender = ImageBlender()
    target_c = max(o_channels, b_channels)
    needs_clipping = not blend_mode_normalized(blend_mode)

    if target_c == 4 and b_channels < 4:
        base = as_target_channels(base, 3)

        # The general algorithm below can be optimized because we know that b_a is 1
        o_a = np.dstack((overlay[:, :, 3],) * 3)
        o_rgb = overlay[:, :, :3]

        blend_rgb = blender.apply_blend(o_rgb, base, blend_mode)
        final_rgb = o_a * blend_rgb + (1 - o_a) * base  # type: ignore
        if needs_clipping:
            final_rgb = np.clip(final_rgb, 0, 1)

        return as_target_channels(final_rgb, 4)

    overlay = as_target_channels(overlay, target_c)
    base = as_target_channels(base, target_c)

    if target_c in (1, 3):
        # We don't need to do any alpha blending, so the images can blended directly
        result = blender.apply_blend(overlay, base, blend_mode)
        if needs_clipping:
            result = np.clip(result, 0, 1)
        return result

    # do the alpha blending for RGBA
    o_a = overlay[:, :, 3]
    b_a = base[:, :, 3]
    o_rgb = overlay[:, :, :3]
    b_rgb = base[:, :, :3]

    final_a = 1 - (1 - o_a) * (1 - b_a)

    blend_strength = o_a * b_a
    o_strength = o_a - blend_strength  # type: ignore
    b_strength = b_a - blend_strength  # type: ignore

    blend_rgb = blender.apply_blend(o_rgb, b_rgb, blend_mode)

    final_rgb = (
        (np.dstack((o_strength,) * 3) * o_rgb)
        + (np.dstack((b_strength,) * 3) * b_rgb)
        + (np.dstack((blend_strength,) * 3) * blend_rgb)
    )
    final_rgb /= np.maximum(np.dstack((final_a,) * 3), 0.0001)  # type: ignore
    final_rgb = np.clip(final_rgb, 0, 1)

    result = np.concatenate([final_rgb, np.expand_dims(final_a, axis=2)], axis=2)
    if needs_clipping:
        result = np.clip(result, 0, 1)
    return result
