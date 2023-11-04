from __future__ import annotations

from enum import Enum
from typing import TYPE_CHECKING

import numpy as np

from ..color.convert import convert
from ..color.convert_data import LAB, RGB

if TYPE_CHECKING:
    from ..image_op import ImageOp


class SplitMode(Enum):
    RGB = 1
    LAB = 2

    def split(self, img: np.ndarray) -> list[np.ndarray]:
        if img.ndim == 2:
            return [img]

        assert img.ndim == 3
        c = img.shape[2]

        if c == 1:
            return [img[:, :, 0]]

        if self == SplitMode.RGB:
            return [img[:, :, channel] for channel in range(c)]
        elif self == SplitMode.LAB:
            if c < 3:
                return [img[:, :, channel] for channel in range(c)]
            lab = convert(img[:, :, 0:3], RGB, LAB)
            remaining_channels = [img[:, :, channel] for channel in range(3, c)]
            return [
                lab[:, :, 0],
                lab[:, :, 1],
                lab[:, :, 2],
                *remaining_channels,
            ]
        else:
            raise AssertionError()

    def combine(self, channels: list[np.ndarray]) -> np.ndarray:
        l = len(channels)
        assert l > 0

        if l == 1:
            return channels[0]

        if self == SplitMode.RGB:
            return np.dstack(channels)
        elif self == SplitMode.LAB:
            if l < 3:
                return np.dstack(channels)
            rgb = convert(np.dstack(channels[0:3]), LAB, RGB)
            if l == 3:
                return rgb
            return np.dstack([rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2], *channels[3:]])
        else:
            raise AssertionError()


def grayscale_split(
    img: np.ndarray, process: ImageOp, mode: SplitMode = SplitMode.RGB
) -> np.ndarray:
    """
    This function guarantees that the given image operation method will be called with 2D single-channel images.
    The images passed into the operation are guaranteed to have the same size as the given image.
    """

    input_channels = mode.split(img)
    output_channels: list[np.ndarray] = []
    for channel in input_channels:
        output_channels.append(process(channel))

    return mode.combine(output_channels)
