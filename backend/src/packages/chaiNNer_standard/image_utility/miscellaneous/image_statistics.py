from __future__ import annotations

from typing import SupportsFloat

import numpy as np

from nodes.properties.inputs import ImageInput, SliderInput
from nodes.properties.outputs import NumberOutput

from .. import miscellaneous_group


@miscellaneous_group.register(
    schema_id="chainner:image:image_statistics",
    name="图像统计",
    description="返回给定图像的统计信息。",
    icon="MdOutlineAssessment",
    inputs=[
        ImageInput(channels=1),
        SliderInput(
            "百分位数",
            precision=2,
            minimum=0,
            maximum=100,
            default=50,
            slider_step=1,
            controls_step=1,
            hide_trailing_zeros=True,
        ),
    ],
    outputs=[
        NumberOutput("最小值", output_type="0..255"),
        NumberOutput("最大值", output_type="0..255"),
        NumberOutput("算术平均值", output_type="0..255"),
        NumberOutput("百分位数", output_type="0..255"),
    ],
)
def image_statistics_node(
    img: np.ndarray,
    percentile: float,
) -> tuple[float, float, float, float]:
    def to_float(n: SupportsFloat) -> float:
        # float32 has ~8 digits of precision.
        # So by rounding to 4 digits, we have 1 digit left over to contain rounding errors
        return round(float(n) * 255, 4)

    return (
        to_float(np.min(img)),
        to_float(np.max(img)),
        to_float(np.mean(img)),
        to_float(np.percentile(img, percentile)),
    )
