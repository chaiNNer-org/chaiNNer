from __future__ import annotations

from enum import Enum

import numpy as np

from nodes.groups import if_enum_group
from nodes.properties.inputs import EnumInput, ImageInput, SliderInput
from nodes.properties.outputs import NumberOutput

from .. import miscellaneous_group


class Stat(Enum):
    MIN = 0
    MAX = 1
    MEAN = 2
    MEDIAN = 3


@miscellaneous_group.register(
    schema_id="chainner:image:image_statistic",
    name="Image Statistic",
    description=("""Returns some statistic of the given image."""),
    icon="MdOutlineAssessment",
    inputs=[
        ImageInput(channels=1),
        EnumInput(
            Stat,
            "Statistic",
            default_value=Stat.MEDIAN,
            option_labels={
                Stat.MIN: "Minimum",
                Stat.MAX: "Maximum",
                Stat.MEAN: "Arithmetic Mean",
                Stat.MEDIAN: "Median",
            },
        ).with_id(1),
        if_enum_group(1, Stat.MEDIAN)(
            SliderInput(
                "Percentile",
                precision=2,
                minimum=0,
                maximum=100,
                default=50,
                slider_step=1,
                controls_step=1,
                hide_trailing_zeros=True,
            ),
        ),
    ],
    outputs=[
        NumberOutput("Result", output_type="0..255"),
    ],
)
def image_statistic(img: np.ndarray, stat: Stat, percentile: float) -> float:
    if stat == Stat.MIN:
        result = np.min(img)
    elif stat == Stat.MAX:
        result = np.max(img)
    elif stat == Stat.MEAN:
        result = np.mean(img)
    elif stat == Stat.MEDIAN:
        if percentile == 50:
            result = np.median(img)
        else:
            result = np.percentile(img, percentile)

    # float32 has ~8 digits of precision.
    # So by rounding to 4 digits, we have 1 digit left over to contain rounding errors
    return round(float(result) * 255, 4)
