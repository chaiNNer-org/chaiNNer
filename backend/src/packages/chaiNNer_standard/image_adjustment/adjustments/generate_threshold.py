from __future__ import annotations

from enum import Enum

import cv2
import numpy as np
from nodes.impl.image_utils import to_uint8
from nodes.properties.inputs import EnumInput, ImageInput
from nodes.properties.outputs import NumberOutput
from nodes.utils.utils import get_h_w_c

from .. import adjustments_group


class AutoThreshold(Enum):
    OTSU = 0
    TRIANGLE = 1


_AUTO_THRESHOLD_LABELS: dict[AutoThreshold, str] = {
    AutoThreshold.OTSU: "Otsu's Method",
    AutoThreshold.TRIANGLE: "Triangle Method",
}


@adjustments_group.register(
    schema_id="chainner:image:generate_threshold",
    name="Generate Threshold",
    description="Automatically determines an optimal threshold value for the given image.",
    icon="MdShowChart",
    inputs=[
        ImageInput(),
        EnumInput(AutoThreshold, "Method", option_labels=_AUTO_THRESHOLD_LABELS),
    ],
    outputs=[
        NumberOutput("Threshold", output_type="0..100"),
    ],
    see_also=[
        "chainner:image:threshold",
    ],
)
def generate_threshold_node(img: np.ndarray, method: AutoThreshold) -> float:
    if get_h_w_c(img)[2] != 1:
        # these methods need grayscale images, so we'll use the mean across all channels
        img = np.mean(img, axis=-1)

    # otsu and triangle methods are only implemented for uint8 images
    img = to_uint8(img, normalized=True)

    if method == AutoThreshold.OTSU:
        threshold, _ = cv2.threshold(img, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    elif method == AutoThreshold.TRIANGLE:
        threshold, _ = cv2.threshold(
            img, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_TRIANGLE
        )

    return threshold / 255 * 100
