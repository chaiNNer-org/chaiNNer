from __future__ import annotations

from typing import Tuple

import numpy as np

from nodes.properties.inputs import ImageInput, SliderInput
from nodes.properties.outputs import NumberOutput
from nodes.utils.utils import get_h_w_c

from .. import utility_group


@utility_group.register(
    schema_id="chainner:image:get_bbox",
    name="Get Bounding Box",
    description="Gets a bounding box (X, Y, Height, and Width) of the white area of a mask.",
    icon="BsBoundingBox",
    inputs=[
        ImageInput(channels=1),
        SliderInput(
            "Threshold",
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
        NumberOutput("Width", output_type="min(uint, Input0.width) & 1.."),
        NumberOutput("Height", output_type="min(uint, Input0.height) & 1.."),
    ],
)
def get_bounding_box_node(
    img: np.ndarray,
    thresh_val: float,
) -> Tuple[int, int, int, int]:
    # Threshold value 100 guarantees an empty image, so make sure the max
    # is just below that.
    thresh = min(thresh_val / 100, 0.99999)
    h, w, _ = get_h_w_c(img)

    r = np.any(img > thresh, 1)
    c = np.any(img > thresh, 0)
    if not r.any():
        raise RuntimeError("Resulting bounding box is empty.")

    x, y = c.argmax(), r.argmax()
    return int(x), int(y), int(w - x - c[::-1].argmax()), int(h - y - r[::-1].argmax())
