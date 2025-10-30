from __future__ import annotations

from enum import Enum

import numpy as np

from nodes.groups import if_enum_group
from nodes.impl.color_transfer.linear_histogram import linear_histogram_transfer
from nodes.impl.color_transfer.mean_std import (
    OverflowMethod,
    TransferColorSpace,
    mean_std_transfer,
)
from nodes.impl.color_transfer.principal_color import principal_color_transfer
from nodes.properties.inputs import BoolInput, EnumInput, ImageInput
from nodes.properties.outputs import ImageOutput
from nodes.utils.utils import get_h_w_c

from .. import correction_group


class TransferColorAlgorithm(Enum):
    MEAN_STD = "mean_std"
    LINEAR_HISTOGRAM = "linear_histogram"
    PRINCIPAL_COLOR = "principal_color"


TRANSFER_COLOR_ALGORITHM_LABELS = {
    TransferColorAlgorithm.MEAN_STD: "Mean+Std",
    TransferColorAlgorithm.LINEAR_HISTOGRAM: "Linear Histogram",
    TransferColorAlgorithm.PRINCIPAL_COLOR: "Principal Color",
}


@correction_group.register(
    schema_id="chainner:image:color_transfer",
    name="Color Transfer",
    description="""Transfers colors from reference image.
            Different combinations of settings may perform better for
            different images. Try multiple setting combinations to find
            best results.""",
    icon="MdInput",
    inputs=[
        ImageInput("Image", channels=[3, 4]),
        ImageInput("Goal Reference Image", channels=[3, 4]),
        EnumInput(
            TransferColorAlgorithm,
            label="Algorithm",
            option_labels=TRANSFER_COLOR_ALGORITHM_LABELS,
            default=TransferColorAlgorithm.MEAN_STD,
        ).with_id(5),
        if_enum_group(5, TransferColorAlgorithm.MEAN_STD)(
            ImageInput("Initial Reference Image", channels=[3, 4])
            .make_optional()
            .with_id(6),
            EnumInput(
                TransferColorSpace,
                label="Colorspace",
                option_labels={TransferColorSpace.LAB: "L*a*b*"},
            ).with_id(2),
            EnumInput(OverflowMethod).with_id(3),
            BoolInput("Reciprocal Scaling Factor", default=True).with_id(4),
        ),
    ],
    outputs=[ImageOutput("Image", shape_as=0)],
)
def color_transfer_node(
    img: np.ndarray,
    ref_img: np.ndarray,
    algorithm: TransferColorAlgorithm,
    init_img: np.ndarray | None,
    colorspace: TransferColorSpace,
    overflow_method: OverflowMethod,
    reciprocal_scale: bool,
) -> np.ndarray:
    if init_img is None:
        init_img = img

    _, _, img_c = get_h_w_c(img)

    # Preserve alpha
    alpha = None
    if img_c == 4:
        alpha = img[:, :, 3]
    bgr_img = img[:, :, :3]

    _, _, init_img_c = get_h_w_c(init_img)

    init_alpha = None
    if init_img_c == 4:
        init_alpha = init_img[:, :, 3]
    bgr_init_img = init_img[:, :, :3]

    _, _, ref_img_c = get_h_w_c(ref_img)

    ref_alpha = None
    if ref_img_c == 4:
        ref_alpha = ref_img[:, :, 3]
    bgr_ref_img = ref_img[:, :, :3]

    # Don't process RGB data if the pixel is fully transparent, since
    # such RGB data is indeterminate.
    init_valid_rgb_indices = np.ones(init_img.shape[:-1], dtype=bool)
    if init_alpha is not None:
        init_valid_rgb_indices = init_alpha > 0

    ref_valid_rgb_indices = np.ones(ref_img.shape[:-1], dtype=bool)
    if ref_alpha is not None:
        ref_valid_rgb_indices = ref_alpha > 0

    transfer = bgr_img
    if algorithm == TransferColorAlgorithm.MEAN_STD:
        transfer = mean_std_transfer(
            bgr_img,
            bgr_ref_img,
            bgr_init_img,
            colorspace,
            overflow_method,
            reciprocal_scale=reciprocal_scale,
            valid_indices=init_valid_rgb_indices,
            ref_valid_indices=ref_valid_rgb_indices,
        )
    elif algorithm == TransferColorAlgorithm.LINEAR_HISTOGRAM:
        transfer = linear_histogram_transfer(
            bgr_img, bgr_ref_img, init_valid_rgb_indices, ref_valid_rgb_indices
        )
    elif algorithm == TransferColorAlgorithm.PRINCIPAL_COLOR:
        transfer = principal_color_transfer(
            bgr_img, bgr_ref_img, init_valid_rgb_indices, ref_valid_rgb_indices
        )

    if alpha is not None:
        transfer = np.dstack((transfer, alpha))

    return transfer
