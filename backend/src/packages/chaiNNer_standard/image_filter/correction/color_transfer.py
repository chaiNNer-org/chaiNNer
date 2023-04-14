from __future__ import annotations

import numpy as np

from nodes.impl.color_transfer import OverflowMethod, TransferColorSpace, color_transfer
from nodes.properties.inputs import BoolInput, EnumInput, ImageInput
from nodes.properties.outputs import ImageOutput
from nodes.utils.utils import get_h_w_c

from .. import correction_group


@correction_group.register(
    schema_id="chainner:image:color_transfer",
    name="Color Transfer",
    description="""Transfers colors from reference image.
            Different combinations of settings may perform better for
            different images. Try multiple setting combinations to find
            best results.""",
    icon="MdInput",
    inputs=[
        ImageInput("Image", channels=[1, 3, 4]),
        ImageInput("Reference Image", channels=[3, 4]),
        EnumInput(
            TransferColorSpace,
            label="Colorspace",
            option_labels={TransferColorSpace.LAB: "L*a*b*"},
        ),
        EnumInput(OverflowMethod),
        BoolInput("Reciprocal Scaling Factor", default=True),
    ],
    outputs=[ImageOutput("Image", image_type="Input0")],
)
def color_transfer_node(
    img: np.ndarray,
    ref_img: np.ndarray,
    colorspace: TransferColorSpace,
    overflow_method: OverflowMethod,
    reciprocal_scale: bool,
) -> np.ndarray:
    """
        Transfers the color distribution from source image to target image.

    This code was adapted from Adrian Rosebrock's color_transfer script,
    found at: https://github.com/jrosebr1/color_transfer (© 2014, MIT license).
    """

    _, _, img_c = get_h_w_c(img)

    # Preserve alpha
    alpha = None
    if img_c == 4:
        alpha = img[:, :, 3]

    transfer = color_transfer(
        img, ref_img, colorspace, overflow_method, reciprocal_scale
    )

    if alpha is not None:
        transfer = np.dstack((transfer, alpha))

    return transfer
