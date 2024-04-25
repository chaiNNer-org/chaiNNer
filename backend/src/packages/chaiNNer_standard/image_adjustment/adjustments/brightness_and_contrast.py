from __future__ import annotations

import numpy as np

from nodes.properties.inputs import ImageInput, SliderInput
from nodes.properties.outputs import ImageOutput
from nodes.utils.utils import get_h_w_c

from .. import adjustments_group


@adjustments_group.register(
    schema_id="chainner:image:brightness_and_contrast",
    description="Adjust the brightness and contrast of an image.",
    name="Brightness & Contrast",
    icon="ImBrightnessContrast",
    inputs=[
        ImageInput(),
        SliderInput(
            "Brightness",
            minimum=-100,
            maximum=100,
            default=0,
            precision=1,
            controls_step=1,
        ),
        SliderInput(
            "Contrast",
            minimum=-100,
            maximum=100,
            default=0,
            precision=1,
            controls_step=1,
        ),
    ],
    outputs=[
        ImageOutput(shape_as=0, assume_normalized=True),
    ],
)
def brightness_and_contrast_node(
    img: np.ndarray, brightness: float, contrast: float
) -> np.ndarray:
    brightness /= 100
    contrast /= 100

    if brightness == 0 and contrast == 0:
        return img

    _, _, c = get_h_w_c(img)

    # Contrast correction factor
    max_c = 259 / 255
    factor: float = (max_c * (contrast + 1)) / (max_c - contrast)
    add: float = factor * brightness + 0.5 * (1 - factor)

    def process_rgb(rgb: np.ndarray):
        if factor == 1:
            out = rgb + add
        else:
            out = factor * rgb
            out += add

        if add < 0 or factor + add > 1:
            out = np.clip(out, 0, 1, out=out)

        return out

    if c <= 3:
        return process_rgb(img)
    else:
        return np.dstack([process_rgb(img[:, :, :3]), img[:, :, 3:]])
