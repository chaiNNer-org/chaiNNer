from __future__ import annotations

import math

import cv2
import numpy as np

from nodes.impl.image_utils import calculate_ssim
from nodes.properties.inputs import ImageInput
from nodes.properties.outputs import NumberOutput
from nodes.utils.utils import get_h_w_c

from .. import miscellaneous_group


@miscellaneous_group.register(
    schema_id="chainner:image:image_metrics",
    name="Image Metrics",
    description=(
        """Calculate image quality metrics (MSE, PSNR, SSIM) between two images."""
    ),
    icon="MdOutlineAssessment",
    inputs=[
        ImageInput("Original Image"),
        ImageInput("Comparison Image"),
    ],
    outputs=[
        NumberOutput("MSE", output_type="0..1"),
        NumberOutput("PSNR", output_type="0.."),
        NumberOutput("SSIM", output_type="0..1"),
    ],
)
def image_metrics_node(
    orig_img: np.ndarray, comp_img: np.ndarray
) -> tuple[float, float, float]:
    assert (
        orig_img.shape == comp_img.shape
    ), "Images must have same dimensions and color depth"

    # If an image is not grayscale, convert to YCrCb and compute metrics
    # on luma channel only
    c = get_h_w_c(orig_img)[2]
    if c > 1:
        orig_img = cv2.cvtColor(orig_img, cv2.COLOR_BGR2YCrCb)[:, :, 0]
        comp_img = cv2.cvtColor(comp_img, cv2.COLOR_BGR2YCrCb)[:, :, 0]

    mse = round(np.mean((comp_img - orig_img) ** 2), 6)  # type: ignore
    psnr = round(10 * math.log(1 / mse), 6)
    ssim = round(calculate_ssim(comp_img, orig_img), 6)

    return (float(mse), float(psnr), ssim)
