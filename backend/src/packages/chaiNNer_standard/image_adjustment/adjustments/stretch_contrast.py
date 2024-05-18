from __future__ import annotations

from enum import Enum

import numpy as np

from nodes.groups import if_enum_group
from nodes.properties.inputs import BoolInput, EnumInput, ImageInput, SliderInput
from nodes.properties.outputs import ImageOutput
from nodes.utils.utils import get_h_w_c

from .. import adjustments_group


def _stretch(img: np.ndarray, range_min: float, range_max: float) -> np.ndarray:
    if range_min > range_max:
        raise ValueError("min must be less than max")
    if range_min == range_max:
        return img * 0

    range_diff = range_max - range_min
    return (img - range_min) / range_diff


class StretchMode(Enum):
    AUTO = 0
    PERCENTILE = 1
    MANUAL = 2


@adjustments_group.register(
    schema_id="chainner:image:stretch_contrast",
    description="Automatically stretches the histogram values in the given image. This is similar to auto levels.",
    name="Stretch Contrast",
    icon="ImContrast",
    inputs=[
        ImageInput(channels=[1, 3, 4]),
        EnumInput(StretchMode, preferred_style="tabs").with_id(1),
        if_enum_group(1, [StretchMode.AUTO, StretchMode.PERCENTILE])(
            BoolInput("Keep Colors", default=True),
        ),
        if_enum_group(1, StretchMode.PERCENTILE)(
            SliderInput(
                "Percentile", min=0, max=50, default=1, precision=2, scale="log"
            ),
        ),
        if_enum_group(1, StretchMode.MANUAL)(
            SliderInput("Minimum", min=0, max=255, default=0, precision=1),
            SliderInput("Maximum", min=0, max=255, default=255, precision=1),
        ),
    ],
    outputs=[
        ImageOutput(
            image_type="""
                let minMaxRangeValid: bool = match Input1 {
                    StretchMode::Manual => Input4 < Input5,
                    _ => true,
                };

                if minMaxRangeValid {
                    Input0
                } else {
                    error("Minimum must be less than Maximum.")
                }
            """,
        ),
    ],
)
def stretch_contrast_node(
    img: np.ndarray,
    mode: StretchMode,
    keep_colors: bool,
    percentile: float,
    manual_min: float,
    manual_max: float,
) -> np.ndarray:
    def get_range_of(i: np.ndarray) -> tuple[float, float]:
        if mode == StretchMode.AUTO:
            return float(np.min(i)), float(np.max(i))
        elif mode == StretchMode.PERCENTILE:
            return float(np.percentile(i, percentile)), float(
                np.percentile(i, 100 - percentile)
            )
        elif mode == StretchMode.MANUAL:
            if manual_min > manual_max:
                raise ValueError("Minimum must be less than Maximum")
            return manual_min / 255, manual_max / 255

    _, _, c = get_h_w_c(img)

    alpha = None
    if c == 4:
        alpha = img[:, :, 3]
        img = img[:, :, :3]

    if keep_colors or mode == StretchMode.MANUAL or c == 1:
        # stretch all channels together

        range_min, range_max = get_range_of(img)
        img = _stretch(img, range_min, range_max)
    else:
        # stretch all channels individually

        channels: list[np.ndarray] = []
        for i in range(get_h_w_c(img)[2]):
            channel = img[:, :, i]

            range_min, range_max = get_range_of(channel)
            channels.append(_stretch(channel, range_min, range_max))

        img = np.dstack(channels)

    if alpha is not None:
        img = np.dstack([img, alpha])

    return img
