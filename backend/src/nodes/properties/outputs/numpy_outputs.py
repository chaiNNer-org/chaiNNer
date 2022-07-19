import base64

from ...utils.image_utils import preview_encode
from ...utils.utils import get_h_w_c
from .base_output import BaseOutput
from .. import expression
import numpy as np
import cv2


class NumPyOutput(BaseOutput):
    """Output a NumPy array"""

    def __init__(self, output_type: expression.ExpressionJson, label: str):
        super().__init__(output_type, label)


def AudioOutput():
    """Output a 1D Audio NumPy array"""
    return NumPyOutput("Audio", "Audio")


class ImageOutput(NumPyOutput):
    def __init__(
        self,
        label: str = "Image",
        image_type: expression.ExpressionJson = "Image",
    ):
        super().__init__(expression.intersect(image_type, "Image"), label)

    def get_broadcast_data(self, value: np.ndarray) -> dict:
        img = value
        h, w, c = get_h_w_c(img)

        base64_img = preview_encode(img, 64)

        return {
            "image": base64_img,
            "height": h,
            "width": w,
            "channels": c,
        }


def VideoOutput():
    """Output a 3D Video NumPy array"""
    return NumPyOutput("Video", "Video")
