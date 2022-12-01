from typing import Optional
import numpy as np

from ...utils.image_utils import preview_encode
from ...utils.utils import get_h_w_c
from ...utils.format import format_image_with_channels
from .base_output import BaseOutput, OutputKind
from .. import expression


class NumPyOutput(BaseOutput):
    """Output a NumPy array"""

    def __init__(
        self,
        output_type: expression.ExpressionJson,
        label: str,
        kind: OutputKind = "generic",
        has_handle: bool = True,
    ):
        super().__init__(output_type, label, kind=kind, has_handle=has_handle)

    def validate(self, value) -> None:
        assert isinstance(value, np.ndarray)


def AudioOutput():
    """Output a 1D Audio NumPy array"""
    return NumPyOutput("Audio", "Audio")


class ImageOutput(NumPyOutput):
    def __init__(
        self,
        label: str = "Image",
        image_type: expression.ExpressionJson = "Image",
        kind: OutputKind = "image",
        has_handle: bool = True,
        broadcast_type: bool = False,
        channels: Optional[int] = None,
    ):
        super().__init__(
            expression.intersect(image_type, expression.Image(channels=channels)),
            label,
            kind=kind,
            has_handle=has_handle,
        )
        self.broadcast_type = broadcast_type

        self.channels: Optional[int] = channels

    def get_broadcast_data(self, value: np.ndarray):
        if not self.broadcast_type:
            return None

        img = value
        h, w, c = get_h_w_c(img)

        return {
            "height": h,
            "width": w,
            "channels": c,
        }

    def validate(self, value) -> None:
        assert isinstance(value, np.ndarray)

        _, _, c = get_h_w_c(value)

        if self.channels is not None and c != self.channels:
            expected = format_image_with_channels([self.channels])
            actual = format_image_with_channels([c])
            raise ValueError(
                f"The output {self.label} was supposed to return {expected} but actually returned {actual}."
                f" This is a bug in the implementation of the node."
                f" Please report this bug."
            )


class LargeImageOutput(ImageOutput):
    def __init__(
        self,
        label: str = "Image",
        image_type: expression.ExpressionJson = "Image",
        kind: OutputKind = "large-image",
        has_handle: bool = True,
    ):
        super().__init__(
            label,
            expression.intersect(image_type, "Image"),
            kind=kind,
            has_handle=has_handle,
        )

    def get_broadcast_data(self, value: np.ndarray):
        img = value
        h, w, c = get_h_w_c(img)

        previews = []
        preview_sizes = [2048, 1024, 512, 256]

        # Encode for multiple scales. Use the preceding scale to save time encoding the smaller sizes.
        last_encoded = img
        for size in preview_sizes:
            if h >= size or w >= size:
                base64, last_encoded = preview_encode(last_encoded, size)
                le_h, le_w, _ = get_h_w_c(last_encoded)
                previews.insert(0, {"size": max(le_h, le_w), "url": base64})

        # Encode the full size image if not all previews are encoded.
        # this includes both when the image is between sizes but smaller than 2k, and when no previews got encoded.
        if len(previews) < len(preview_sizes):
            base64, _ = preview_encode(img, max(h, w))
            previews.insert(0, {"size": max(h, w), "url": base64})

        return {
            "previews": previews,
            "height": h,
            "width": w,
            "channels": c,
        }


def VideoOutput():
    """Output a 3D Video NumPy array"""
    return NumPyOutput("Video", "Video")
