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
        image_size = max(h, w)

        preview_sizes = [2048, 1024, 512, 256]
        preview_size_grace = 1.2

        start_index = len(preview_sizes) - 1
        for i, size in enumerate(preview_sizes):
            if size <= image_size and image_size <= size * preview_size_grace:
                # this preview size will perfectly fit the image
                start_index = i
                break
            if image_size > size:
                # the image size is larger than the preview size, so try to pick the previous size
                start_index = max(0, i - 1)
                break

        previews = []

        # Encode for multiple scales. Use the preceding scale to save time encoding the smaller sizes.
        last_encoded = img
        for size in preview_sizes[start_index:]:
            largest_preview = size == preview_sizes[start_index]
            base64, last_encoded = preview_encode(
                last_encoded,
                target_size=size,
                grace=preview_size_grace,
                lossless=largest_preview,
            )
            le_h, le_w, _ = get_h_w_c(last_encoded)
            previews.insert(0, {"size": max(le_h, le_w), "url": base64})

        return {
            "previews": previews,
            "height": h,
            "width": w,
            "channels": c,
        }


def VideoOutput():
    """Output a 3D Video NumPy array"""
    return NumPyOutput("Video", "Video")
