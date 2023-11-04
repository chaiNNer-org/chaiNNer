# pylint: disable=relative-beyond-top-level
from __future__ import annotations

from typing import Union

import numpy as np

import navi
from api import BaseInput, ErrorValue

from ...impl.color.color import Color
from ...utils.format import format_color_with_channels, format_image_with_channels
from ...utils.utils import get_h_w_c


class AudioInput(BaseInput):
    """Input a 1D Audio NumPy array"""

    def __init__(self, label: str = "Audio"):
        super().__init__("Audio", label)


class ImageInput(BaseInput):
    """Input a 2D Image NumPy array"""

    def __init__(
        self,
        label: str = "Image",
        image_type: navi.ExpressionJson = "Image | Color",
        channels: int | list[int] | None = None,
        allow_colors: bool = False,
    ):
        base_type = [navi.Image(channels=channels)]
        if allow_colors:
            base_type.append(navi.Color(channels=channels))
        image_type = navi.intersect(image_type, base_type)
        super().__init__(image_type, label)

        self.channels: list[int] | None = (
            [channels] if isinstance(channels, int) else channels
        )
        self.allow_colors: bool = allow_colors

        self.associated_type = np.ndarray

        if self.allow_colors:
            self.associated_type = Union[np.ndarray, Color]

    def enforce(self, value):
        if isinstance(value, Color):
            if not self.allow_colors:
                raise ValueError(
                    f"The input {self.label} does not accept colors, but was connected with one."
                )

            if self.channels is not None and value.channels not in self.channels:
                expected = format_color_with_channels(self.channels, plural=True)
                actual = format_color_with_channels([value.channels])
                raise ValueError(
                    f"The input {self.label} only supports {expected} but was given {actual}."
                )

            return value

        assert isinstance(value, np.ndarray)
        _, _, c = get_h_w_c(value)

        if self.channels is not None and c not in self.channels:
            expected = format_image_with_channels(self.channels, plural=True)
            actual = format_image_with_channels([c])
            raise ValueError(
                f"The input {self.label} only supports {expected} but was given {actual}."
            )

        assert value.dtype == np.float32, "Expected the input image to be normalized."

        if c == 1 and value.ndim == 3:
            value = value[:, :, 0]

        return value

    def get_error_value(self, value) -> ErrorValue:
        def get_channels(channel: int) -> str:
            if channel == 1:
                return "Grayscale"
            if channel == 3:
                return "RGB"
            if channel == 4:
                return "RGBA"
            return f"{channel}-channel"

        if isinstance(value, Color):
            return {
                "type": "formatted",
                "formatString": f"{get_channels(value.channels)} Color",
            }
        elif isinstance(value, np.ndarray):
            h, w, c = get_h_w_c(value)
            return {
                "type": "formatted",
                "formatString": f"{get_channels(c)} Image {w}x{h}",
            }
        else:
            return super().get_error_value(value)


class VideoInput(BaseInput):
    """Input a 3D Video NumPy array"""

    def __init__(self, label: str = "Video"):
        super().__init__("Video", label)
