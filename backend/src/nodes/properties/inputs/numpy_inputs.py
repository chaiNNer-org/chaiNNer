# pylint: disable=relative-beyond-top-level

from ...utils.image_utils import normalize
from .base_input import BaseInput


class NumPyInput(BaseInput):
    def __init__(self, input_type: str, label: str):
        super().__init__(f"numpy::{input_type}", label)


class AudioInput(NumPyInput):
    """Input a 1D Audio NumPy array"""

    def __init__(self, label: str = "Audio"):
        super().__init__("1d", label)


class ImageInput(NumPyInput):
    """Input a 2D Image NumPy array"""

    def __init__(self, label: str = "Image"):
        super().__init__("2d", label)

    def enforce(self, value):
        return normalize(value)


class VideoInput(NumPyInput):
    """Input a 3D Video NumPy array"""

    def __init__(self, label: str = "Video"):
        super().__init__("3d", label)
