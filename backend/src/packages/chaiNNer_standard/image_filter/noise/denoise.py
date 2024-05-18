from __future__ import annotations

import cv2
import numpy as np

from nodes.groups import Condition, if_group
from nodes.impl.image_utils import to_uint8
from nodes.properties.inputs import ImageInput, NumberInput, SliderInput
from nodes.properties.outputs import ImageOutput
from nodes.utils.utils import get_h_w_c

from .. import noise_group


@noise_group.register(
    schema_id="chainner:image:fast_nlmeans",
    name="Denoise",
    description="Use the fast Non-Local Means algorithm to denoise an image.",
    icon="CgEditNoise",
    inputs=[
        ImageInput("Image", channels=[1, 3, 4]),
        SliderInput(
            "Luminance strength",
            min=0,
            max=50,
            default=3.0,
            precision=1,
            step=0.1,
            slider_step=0.1,
        ),
        if_group(Condition.type(0, "Image { channels: 3 | 4 }"))(
            SliderInput(
                "Color strength",
                min=0.0,
                max=50.0,
                default=3.0,
                precision=1,
                step=0.1,
                slider_step=0.1,
            )
        ),
        NumberInput("Patch radius", min=1, default=3, max=30),
        NumberInput("Search radius", min=1, default=10, max=30),
    ],
    outputs=[ImageOutput(shape_as=0)],
    limited_to_8bpc=True,
)
def denoise_node(
    img: np.ndarray,
    h: float,
    h_color: float,
    patch_radius: int,
    search_radius: int,
) -> np.ndarray:
    _, _, c = get_h_w_c(img)
    image_array = to_uint8(img)

    patch_window_size = 2 * patch_radius + 1
    search_window_size = 2 * search_radius + 1

    if c == 1:
        denoised = cv2.fastNlMeansDenoising(
            src=image_array,
            h=h,
            templateWindowSize=patch_window_size,
            searchWindowSize=search_window_size,
        )

    else:
        rgb = image_array[:, :, :3]
        alpha = None
        if c == 4:
            alpha = image_array[:, :, 3]

        denoised = cv2.fastNlMeansDenoisingColored(
            src=rgb,
            h=h,
            hColor=h_color,
            templateWindowSize=patch_window_size,
            searchWindowSize=search_window_size,
        )

        if alpha is not None:
            denoised = np.dstack((denoised, alpha))

    return denoised
