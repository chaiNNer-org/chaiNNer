from .base_output import BaseOutput


class NumPyOutput(BaseOutput):
    """Output a NumPy array"""

    def __init__(self, numpy_type: str, label: str):
        super().__init__(f"numpy::{numpy_type}", label)


def AudioOutput():
    """Output a 1D Audio NumPy array"""
    return NumPyOutput("1d", "Audio")


def ImageOutput(label: str = "Image"):
    """Output a 2D Image NumPy array"""
    return NumPyOutput("2d", label)


def VideoOutput():
    """Output a 3D Video NumPy array"""
    return NumPyOutput("3d", "Video")


def SplitImageChannelOutput():
    """Split a single multi-channel numpy array into multiple single-channel arrays"""
    return NumPyOutput("2d::split", "Image")
