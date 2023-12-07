from __future__ import annotations

from enum import Enum

import numpy as np

from nodes.groups import if_enum_group, required
from nodes.impl.image_utils import fast_gaussian_blur
from nodes.properties.inputs import EnumInput, ImageInput, SliderInput
from nodes.properties.outputs import ImageOutput
from nodes.utils.utils import get_h_w_c

from .. import miscellaneous_group


class BlurMode(Enum):
    GAUSSIAN = 0
    CUSTOM = 1


@miscellaneous_group.register(
    schema_id="chainner:image:high_pass",
    name="High Pass",
    description=[
        "Apply High Pass filter on image.",
        "A high pass filter is a filter will remove all low-frequency detail below a certain threshold. This will result in an image that is mostly edges and high-frequency detail.",
        "In more concrete terms, this means that the node return `contrast * (image - blurred) + 0.5`. `blurred` is either the input image with a gaussian blur applied to it or a custom blurred image. Gaussian blur is recommended, because it is correct from a single-processing point of view.",
        "Note: This node will leave the alpha channel of the image (if it has one) unchanged.",
    ],
    icon="MdOutlineAutoFixHigh",
    inputs=[
        ImageInput(channels=[1, 3, 4]),
        EnumInput(BlurMode, default=BlurMode.GAUSSIAN, preferred_style="tabs").with_id(
            3
        ),
        if_enum_group(3, BlurMode.GAUSSIAN)(
            SliderInput(
                "Blur Radius",
                minimum=0,
                maximum=1000,
                default=3,
                precision=1,
                controls_step=1,
                slider_step=0.1,
                scale="log",
            ).with_id(1),
        ),
        if_enum_group(3, BlurMode.CUSTOM)(
            required()(
                ImageInput("Blurred Image", channels=[1, 3, 4])
                .make_optional()
                .with_id(4),
            ),
        ),
        SliderInput(
            "Contrast",
            minimum=0,
            maximum=100,
            default=1,
            precision=2,
            controls_step=0.1,
            scale="log-offset",
        ).with_id(2),
    ],
    outputs=[
        ImageOutput(
            image_type="""
                let i = Input0;
                let mode = Input3;
                let blurred = Input4;

                match mode {
                    BlurMode::Gaussian => i,
                    BlurMode::Custom => {
                        let valid = i == blurred;

                        if valid { i } else { never }
                    },
                }
            """
        ),
    ],
)
def high_pass_node(
    img: np.ndarray,
    mode: BlurMode,
    radius: float,
    blurred: np.ndarray | None,
    contrast: float,
) -> np.ndarray:
    _, _, c = get_h_w_c(img)
    alpha = None
    if c > 3:
        alpha = img[:, :, 3]
        img = img[:, :, :3]

    if mode == BlurMode.GAUSSIAN:
        img = contrast * (img - fast_gaussian_blur(img, radius)) + 0.5
    else:
        assert blurred is not None, "Expected a blurred image to be given."
        assert (
            blurred.shape == img.shape
        ), "Expected blurred image to have same shape as the input image."
        img = contrast * (img - blurred) + 0.5

    if alpha is not None:
        img = np.dstack((img, alpha))

    return img
