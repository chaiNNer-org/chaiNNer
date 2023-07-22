from __future__ import annotations

import cv2
import numpy as np

from nodes.properties.inputs import ImageInput, SliderInput
from nodes.properties.outputs import ImageOutput
from nodes.utils.utils import get_h_w_c

from .. import adjustments_group


def with_lightness(img: np.ndarray, lightness: float) -> np.ndarray:
    if lightness > 0:
        return img + (1 - img) * lightness
    elif lightness < 0:
        return img * (1 + lightness)
    else:
        return img


@adjustments_group.register(
    schema_id="chainner:image:hue_and_saturation",
    name="Hue & Saturation",
    description="Adjust the hue and saturation of an image. This is performed in the HSV color-space.",
    icon="MdOutlineColorLens",
    inputs=[
        ImageInput(channels=[1, 3, 4]),
        SliderInput(
            "Hue",
            minimum=-180,
            maximum=180,
            default=0,
            precision=1,
            controls_step=1,
            gradient=[
                "#ff0000",
                "#ffff00",
                "#00ff00",
                "#00ffff",
                "#0000ff",
                "#ff00ff",
                "#ff0000",
            ],
        ),
        SliderInput(
            "Saturation",
            minimum=-100,
            maximum=100,
            default=0,
            precision=1,
            controls_step=1,
            # gradient from gray to saturated
            gradient=["#808080", "#ff0000"],
        ),
        SliderInput(
            "Lightness",
            minimum=-100,
            maximum=100,
            default=0,
            precision=1,
            controls_step=1,
            gradient=["#000000", "#ffffff"],
        ),
    ],
    outputs=[ImageOutput(image_type="Input0")],
)
def hue_and_saturation_node(
    img: np.ndarray,
    hue: float,
    saturation: float,
    lightness: float,
) -> np.ndarray:
    """Adjust the hue and saturation of an image"""

    saturation /= 100
    lightness /= 100

    _, _, c = get_h_w_c(img)

    # Pass through unadjusted images
    if hue == 0 and saturation == 0 and lightness == 0:
        return img

    if c == 1:
        # Hue and saturation have no effect on grayscale, so we just need to adjust lightness
        return with_lightness(img, lightness)

    # Preserve alpha channel if it exists
    alpha = None
    if c > 3:
        alpha = img[:, :, 3]

    h, l, s = cv2.split(cv2.cvtColor(img[:, :, :3], cv2.COLOR_BGR2HLS))

    # Adjust hue
    if hue != 0:
        h += hue
        h[h >= 360] -= 360  # Wrap positive overflow
        h[h < 0] += 360  # Wrap negative overflow

    # Adjust saturation
    if saturation != 0:
        saturation = 1 + saturation
        s = np.clip(s * saturation, 0, 1)

    img = cv2.cvtColor(cv2.merge([h, l, s]), cv2.COLOR_HLS2BGR)

    # Adjust lightness
    img = with_lightness(img, lightness)

    # Re-add alpha, if it exists
    if alpha is not None:
        img = np.dstack((img, alpha))

    return img
