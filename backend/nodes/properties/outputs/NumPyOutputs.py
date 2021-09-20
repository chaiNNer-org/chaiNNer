from typing import Dict


def NumPyOutput(type: str, label: str) -> Dict:
    """ Output a NumPy array """
    return {
        "type": f"numpy::{type}",
        "label": label,
    }


def AudioOutput() -> Dict:
    """ Output a 1D Audio NumPy array """
    return NumPyOutput("1d", "Audio")


def ImageOutput(label: str = "Image") -> Dict:
    """ Output a 2D Image NumPy array """
    return NumPyOutput("2d", label)


def VideoOutput() -> Dict:
    """ Output a 3D Video NumPy array """
    return NumPyOutput("3d", "Video")


def SplitImageChannelOutput() -> Dict:
    """ Split a single multi-channel numpy array into multiple single-channel arrays """
    return NumPyOutput("2d::split", "Image")
