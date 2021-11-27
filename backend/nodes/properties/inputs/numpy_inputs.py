from typing import Dict


def NumPyInput(input_type: str, label: str, optional=False) -> Dict:
    """Input a NumPy array"""
    return {
        "type": f"numpy::{input_type}",
        "label": label,
        "optional": optional,
    }


def AudioInput() -> Dict:
    """Input a 1D Audio NumPy array"""
    return NumPyInput("1d", "Audio")


def ImageInput(label: str = "Image", optional=False) -> Dict:
    """Input a 2D Image NumPy array"""
    return NumPyInput("2d", label, optional)


def VideoInput() -> Dict:
    """Input a 3D Video NumPy array"""
    return NumPyInput("3d", "Video")


def SplitImageChannelImage() -> Dict:
    """Combine multiple single-channel arrays into a single multi-channel numpy array"""
    return NumPyInput("2d::merge", "Image")
