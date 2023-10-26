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
    outputs=[ImageOutput(image_type="Input0")],
)
def brightness_and_contrast_node(
    img: np.ndarray, brightness: float, contrast: float
) -> np.ndarray:
    """Adjusts the brightness and contrast of an image"""

    brightness /= 100
    contrast /= 100

    if brightness == 0 and contrast == 0:
        return img

    _, _, c = get_h_w_c(img)

    # Contrast correction factor
    max_c = 259 / 255
    factor: float = (max_c * (contrast + 1)) / (max_c - contrast)
    add: float = factor * brightness + 0.5 * (1 - factor)

    if c <= 3:
        img = factor * img + add
    else:
        img = np.concatenate(
            [
                factor * img[:, :, :3] + add,
                img[:, :, 3:],
            ],
            axis=2,
        )

    return img
