import base64
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

    def broadcast(self, value: np.ndarray) -> dict:
        img = value
        h, w, c = get_h_w_c(img)

        # resize the image, so the preview loads faster and doesn't lag the UI
        # 512 was chosen as the target because a 512x512 RGBA 8bit PNG is at most 1MB in size
        target_size = 512
        max_size = target_size * 1.2
        if w > max_size or h > max_size:
            f = max(w / target_size, h / target_size)
            img = cv2.resize(
                img, (int(w / f), int(h / f)), interpolation=cv2.INTER_AREA
            )

        _, encoded_img = cv2.imencode(".png", (img * 255).astype("uint8"))  # type: ignore
        base64_img = base64.b64encode(encoded_img).decode("utf8")

        return {
            "image": "data:image/png;base64," + base64_img,
            "height": h,
            "width": w,
            "channels": c,
        }


def VideoOutput():
    """Output a 3D Video NumPy array"""
    return NumPyOutput("Video", "Video")
