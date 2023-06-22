from __future__ import annotations

from typing import Tuple

import cv2
import numpy as np

from nodes.properties.inputs import ImageInput, NumberInput, SliderInput
from nodes.properties.outputs import NumberOutput
from nodes.utils.utils import get_h_w_c

from .. import utility_group


@utility_group.register(
    schema_id="chainner:image:get_bbox",
    name="Get Bounding Box",
    description="Get the X, Y, Height, and Width of a bounding box in the image in px.",
    icon="BsRulers",
    inputs=[
        ImageInput(channels=1),
        SliderInput(
            "Threshold",
            precision=1,
            minimum=1,
            controls_step=1,
            slider_step=1,
            default=1,
        ),
    ],
    outputs=[
        NumberOutput("X"),
        NumberOutput("Y"),
        NumberOutput("Width"),
        NumberOutput("Height"),
    ],
)
def get_dimensions_node(
    img: np.ndarray,
    thresh_val: float,
) -> Tuple[int, int, int, int]:
    # Threshold value 100 guarantees an empty image, so make sure the max
    # is just below that.
    thresh = min(thresh_val / 100, 0.99999)
    h, w, _ = get_h_w_c(img)

    r = np.any(img > thresh, 1)
    if r.any():
        c = np.any(img > thresh, 0)
        x, y = c.argmax(), r.argmax()
        return (
            int(x),
            int(y),
            int(w - x - c[::-1].argmax()),
            int(h - y - r[::-1].argmax()),
        )
    else:
        return 0, 0, w, h
