from __future__ import annotations

from typing import Callable, Iterable

import numpy as np

from ...utils.format import format_image_with_channels
from ...utils.utils import get_h_w_c


class ColorSpace:
    def __init__(self, id_: int, name: str, channels: int):
        assert id_ >= 0 and id_ < 256
        self.id = id_
        self.name = name
        self.channels = channels


class ColorSpaceDetector:
    def __init__(self, id_: int, name: str, color_spaces: Iterable[ColorSpace]) -> None:
        assert id_ >= 1000 and id_ < 2000
        self.id = id_
        self.name = name
        self.channel_map: dict[int, ColorSpace] = {}
        for cs in color_spaces:
            assert cs.channels not in self.channel_map
            self.channel_map[cs.channels] = cs
        self.channels = list(self.channel_map.keys())

    def detect(self, image: np.ndarray) -> ColorSpace:
        c = get_h_w_c(image)[2]
        cs = self.channel_map.get(c, None)
        if cs is not None:
            return cs

        raise ValueError(
            f"Expected the input image for {self.name}"
            f" to be {format_image_with_channels(self.channels)}"
            f" but found {format_image_with_channels([c])}."
        )


def assert_input_channels(img: np.ndarray, input_: ColorSpace, output: ColorSpace):
    c = get_h_w_c(img)[2]
    if c != input_.channels:
        raise ValueError(
            f"Expected the input image for a {input_.name} -> {output.name} conversion"
            f" to be {format_image_with_channels([input_.channels])}"
            f" but found {format_image_with_channels([c])}."
        )


def assert_output_channels(result: np.ndarray, input_: ColorSpace, output: ColorSpace):
    c = get_h_w_c(result)[2]
    if c != output.channels:
        raise ValueError(
            f"Expected the output image for a {input_.name} -> {output.name} conversion"
            f" to be {format_image_with_channels([output.channels])}"
            f" but found {format_image_with_channels([c])}."
            f" This is an internal implementation error."
            f" Please report this as a bug."
        )


ConvertFn = Callable[[np.ndarray], np.ndarray]


class Conversion:
    def __init__(
        self,
        direction: tuple[ColorSpace, ColorSpace],
        convert: ConvertFn,
        cost: int = 1,
    ):
        input_, output = direction
        assert input_ != output
        self.input: ColorSpace = input_
        self.output: ColorSpace = output
        self.__convert = convert
        assert cost >= 1
        self.cost: int = cost

    def convert(self, img: np.ndarray) -> np.ndarray:
        assert_input_channels(img, self.input, self.output)
        result = self.__convert(img)
        assert_output_channels(result, self.input, self.output)
        return result
