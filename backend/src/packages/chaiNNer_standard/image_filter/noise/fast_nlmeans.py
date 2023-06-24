from __future__ import annotations

import numpy as np
import cv2

from nodes.properties.inputs import ImageInput, SliderInput, NumberInput
from nodes.properties.outputs import ImageOutput
from nodes.groups import Condition, if_group
from nodes.impl.image_utils import to_uint8
from nodes.utils.utils import get_h_w_c

from .. import noise_group


@noise_group.register(
    schema_id="chainner:image:fast_nlmeans",
    name="Fast NL means",
    description="Use the fast Non-Local Means algorithm to denoise an image.",
    icon="CgEditNoise",
    inputs=[
        ImageInput("Image", channels=[1, 3, 4]),
        SliderInput(
            "Luminance strength",
            minimum=0,
            maximum=50,
            default=3.0,
            precision=1,
            controls_step=0.1,
            slider_step=0.1,
        ),
        if_group(Condition.type(0, "Image { channels: 3 | 4 }"))(
            SliderInput(
                "Color strength",
                minimum=0.,
                maximum=50.,
                default=3.,
                precision=1,
                controls_step=0.1,
                slider_step=0.1,
            )
        ),
        NumberInput("Patch radius",
            minimum=1,
            default=3,
            maximum=30,
            precision=0),
        NumberInput("Search radius",
            minimum=1,
            default=10,
            maximum=30,
            precision=0),
    ],
    outputs=[ImageOutput(image_type="Input0")],
)
def fast_nlmeans_node(
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
        denoised = cv2.fastNlMeansDenoising(src= image_array, h=h,
            templateWindowSize=patch_window_size,
            searchWindowSize=search_window_size)

    else:
        rgb = image_array[:, :, :3]
        if c == 4:
            alpha = image_array[:, :, 3]

        denoised = cv2.fastNlMeansDenoisingColored(src=rgb, h=h, hColor=h_color,
            templateWindowSize=patch_window_size,
            searchWindowSize=search_window_size)

        if c == 4:
            denoised = np.dstack((denoised, alpha))

    return denoised

