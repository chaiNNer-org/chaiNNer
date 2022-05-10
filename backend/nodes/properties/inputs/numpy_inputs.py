# pylint: disable=relative-beyond-top-level
from ...utils.image_utils import normalize
from .base_input import BaseInput


class NumPyInput(BaseInput):
    def __init__(self, input_type: str, label: str, optional=False):
        super().__init__(f"numpy::{input_type}", label, optional)


class AudioInput(NumPyInput):
    def __init__(self, label: str = "Audio", optional=False):
        """Input a 1D Audio NumPy array"""
        super().__init__("1d", label, optional)


class ImageInput(NumPyInput):
    def __init__(self, label: str = "Image", optional=False):
        """Input a 2D Image NumPy array"""
        super().__init__("2d", label, optional)

    def enforce(self, value):
        assert value is not None, "Image does not exist"
        return normalize(value)


class VideoInput(NumPyInput):
    def __init__(self, label: str = "Video", optional=False):
        """Input a 3D Video NumPy array"""
        super().__init__("3d", label, optional)
