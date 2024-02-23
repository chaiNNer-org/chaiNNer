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
    name="快速NL均值s",
    description="使用快速非局部均值算法对图像进行去噪。",
    icon="CgEditNoise",
    inputs=[
        ImageInput("图像", channels=[1, 3, 4]),
        SliderInput(
            "亮度强度",
            minimum=0,
            maximum=50,
            default=3.0,
            precision=1,
            controls_step=0.1,
            slider_step=0.1,
        ),
        if_group(Condition.type(0, "Image { channels: 3 | 4 }"))(
            SliderInput(
                "颜色强度",
                minimum=0.0,
                maximum=50.0,
                default=3.0,
                precision=1,
                controls_step=0.1,
                slider_step=0.1,
            )
        ),
        NumberInput("块半径", minimum=1, default=3, maximum=30, precision=0),
        NumberInput("搜索半径", minimum=1, default=10, maximum=30, precision=0),
    ],
    outputs=[ImageOutput(image_type="Input0")],
    limited_to_8bpc=True,
)
def fast_nl_means_node(
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
