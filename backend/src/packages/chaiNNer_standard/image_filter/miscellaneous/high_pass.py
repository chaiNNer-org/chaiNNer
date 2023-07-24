from __future__ import annotations

import numpy as np

from nodes.impl.image_utils import fast_gaussian_blur
from nodes.properties.inputs import ImageInput, SliderInput
from nodes.properties.outputs import ImageOutput

from .. import miscellaneous_group


@miscellaneous_group.register(
    schema_id="chainner:image:high_pass",
    name="High Pass",
    description=[
        "Apply High Pass filter on image.",
        "A high pass filter is a filter will remove all low-frequency detail below a certain threshold. This will result in an image that is mostly edges and high-frequency detail.",
        "Note: This node will leave the alpha channel of the image (if it has one) unchanged.",
    ],
    icon="MdOutlineAutoFixHigh",
    inputs=[
        ImageInput(channels=[1, 3, 4]),
        SliderInput(
            "Radius",
            minimum=0,
            maximum=1000,
            default=3,
            precision=1,
            controls_step=1,
            slider_step=0.1,
            scale="log",
        ),
        SliderInput(
            "Contrast",
            minimum=0,
            maximum=100,
            default=1,
            precision=2,
            controls_step=0.1,
            scale="log-offset",
        ),
    ],
    outputs=[ImageOutput(image_type="Input0")],
)
def high_pass_node(
    img: np.ndarray,
    radius: float,
    contrast: float,
) -> np.ndarray:
    alpha = None
    if img.shape[2] > 3:
        alpha = img[:, :, 3]
        img = img[:, :, :3]

    if radius == 0 or contrast == 0:
        img = img * 0 + 0.5
    else:
        img = contrast * (img - fast_gaussian_blur(img, radius)) + 0.5  # type: ignore

    if alpha is not None:
        img = np.dstack((img, alpha))

    return img
