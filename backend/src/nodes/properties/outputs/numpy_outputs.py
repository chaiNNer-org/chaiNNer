from .base_output import BaseOutput
from .. import expression


class NumPyOutput(BaseOutput):
    """Output a NumPy array"""

    def __init__(self, output_type: expression.ExpressionJson, label: str):
        super().__init__(output_type, label)


def AudioOutput():
    """Output a 1D Audio NumPy array"""
    return NumPyOutput("Audio", "Audio")


def ImageOutput(
    label: str = "Image",
    image_type: expression.ExpressionJson = "Image",
):
    """Output a 2D Image NumPy array"""
    return NumPyOutput(expression.intersection([image_type, "Image"]), label)


def VideoOutput():
    """Output a 3D Video NumPy array"""
    return NumPyOutput("Video", "Video")
