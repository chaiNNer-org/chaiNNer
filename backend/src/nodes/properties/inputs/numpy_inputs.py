# pylint: disable=relative-beyond-top-level

from typing import List, Optional, Union

import numpy as np

from ...impl.image_utils import get_h_w_c, normalize
from ...utils.format import format_image_with_channels
from .. import expression
from .base_input import BaseInput


class AudioInput(BaseInput):
    """Input a 1D Audio NumPy array"""

    def __init__(self, label: str = "Audio"):
        super().__init__("Audio", label)


class ImageInput(BaseInput):
    """Input a 2D Image NumPy array"""

    def __init__(
        self,
        label: str = "Image",
        image_type: expression.ExpressionJson = "Image",
        channels: Union[int, List[int], None] = None,
    ):
        image_type = expression.intersect(
            image_type,
            expression.Image(channels=channels),
        )
        super().__init__(image_type, label)

        self.channels: Optional[List[int]] = (
            [channels] if isinstance(channels, int) else channels
        )

        # TODO: Maybe some day...
        # Create a valid union type from the channels list
        # channel_str = int
        # if self.channels is not None:
        #     channel_str = eval(f"Literal[{', '.join([str(c) for c in self.channels])}]")

        # Shape = Tuple[int, int, channel_str]

        # self.associated_type = np.ndarray[Shape, np.dtype[np.float32]]
        self.associated_type = np.ndarray

    def enforce(self, value):
        _, _, c = get_h_w_c(value)

        if self.channels is not None and c not in self.channels:
            expected = format_image_with_channels(self.channels, plural=True)
            actual = format_image_with_channels([c])
            raise ValueError(
                f"The input {self.label} only supports {expected} but was given {actual}."
            )

        if c == 1 and value.ndim == 3:
            value = value[:, :, 0]

        return normalize(value)


class VideoInput(BaseInput):
    """Input a 3D Video NumPy array"""

    def __init__(self, label: str = "Video"):
        super().__init__("Video", label)
