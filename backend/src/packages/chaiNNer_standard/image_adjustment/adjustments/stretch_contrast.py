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
        raise ValueError("最小值必须小于最大值")
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
    description="自动拉伸给定图像的直方图值。类似于自动级别调整。",
    name="拉伸对比度",
    icon="ImContrast",
    inputs=[
        ImageInput(channels=[1, 3, 4]),
        EnumInput(StretchMode, preferred_style="tabs").with_id(1),
        if_enum_group(1, [StretchMode.AUTO, StretchMode.PERCENTILE])(
            BoolInput("保留颜色", default=True),
        ),
        if_enum_group(1, StretchMode.PERCENTILE)(
            SliderInput(
                "百分位数", minimum=0, maximum=50, default=1, precision=2, scale="log"
            ),
        ),
        if_enum_group(1, StretchMode.MANUAL)(
            SliderInput("最小值", minimum=0, maximum=255, default=0, precision=1),
            SliderInput("最大值", minimum=0, maximum=255, default=255, precision=1),
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
                    error("最小值必须小于最大值。")
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
