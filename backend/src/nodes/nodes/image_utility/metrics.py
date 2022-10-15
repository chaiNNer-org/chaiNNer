from __future__ import annotations
from typing import Tuple
import math

import numpy as np
import cv2

from . import category as ImageUtilityCategory
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import ImageInput
from ...properties.outputs import NumberOutput
from ...utils.image_utils import calculate_ssim
from ...utils.utils import get_h_w_c


@NodeFactory.register("chainner:image:image_metrics")
class ImageMetricsNode(NodeBase):
    """Calculate image quality metrics of modified image."""

    def __init__(self):
        super().__init__()
        self.description = (
            """Calculate image quality metrics (MSE, PSNR, SSIM) between two images."""
        )
        self.inputs = [
            ImageInput("Original Image"),
            ImageInput("Comparison Image"),
        ]
        self.outputs = [
            NumberOutput("MSE", output_type="0..1"),
            NumberOutput("PSNR", output_type="0.."),
            NumberOutput("SSIM", output_type="0..1"),
        ]
        self.category = ImageUtilityCategory
        self.name = "Image Metrics"
        self.icon = "MdOutlineAssessment"
        self.sub = "Miscellaneous"

    def run(
        self, orig_img: np.ndarray, comp_img: np.ndarray
    ) -> Tuple[float, float, float]:
        """Compute MSE, PSNR, and SSIM"""

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
