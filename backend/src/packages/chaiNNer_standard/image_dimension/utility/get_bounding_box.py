from __future__ import annotations

import numpy as np

from nodes.properties.inputs import ImageInput, SliderInput
from nodes.properties.outputs import NumberOutput
from nodes.utils.utils import get_h_w_c

from .. import utility_group


@utility_group.register(
    schema_id="chainner:image:get_bbox",
    name="获取边界框",
    description="获取掩码白色区域的边界框（X、Y、高度和宽度）。",
    icon="BsBoundingBox",
    inputs=[
        ImageInput(channels=1),
        SliderInput(
            "阈值",
            precision=1,
            minimum=0,
            maximum=100,
            controls_step=1,
            slider_step=1,
            default=0,
        ),
    ],
    outputs=[
        NumberOutput("X", output_type="min(uint, Input0.width - 1) & 0.."),
        NumberOutput("Y", output_type="min(uint, Input0.height - 1) & 0.."),
        NumberOutput("宽度", output_type="min(uint, Input0.width) & 1.."),
        NumberOutput("高度", output_type="min(uint, Input0.height) & 1.."),
    ],
)
def get_bounding_box_node(
    img: np.ndarray,
    thresh_val: float,
) -> tuple[int, int, int, int]:
    # Threshold value 100 guarantees an empty image, so make sure the max
    # is just below that.
    thresh = min(thresh_val / 100, 0.99999)
    h, w, _ = get_h_w_c(img)

    r = np.any(img > thresh, 1)
    c = np.any(img > thresh, 0)
    if not r.any():
        raise RuntimeError("生成的边界框为空。")

    x, y = c.argmax(), r.argmax()
    return int(x), int(y), int(w - x - c[::-1].argmax()), int(h - y - r[::-1].argmax())
