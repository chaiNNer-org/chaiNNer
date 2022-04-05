import os
from typing import Dict, List


def FileOutput(input_type: str, label: str, filetypes: List[str]) -> Dict:
    """Output for saving a local file"""
    return {
        "type": f"file::{input_type}",
        "label": label,
        "filetypes": filetypes,
    }


def ImageFileOutput(label: str = "image") -> Dict:
    """Output for saving a local image file"""
    return FileOutput(
        label, "Image File", ["png", "jpg", "jpeg", "gif", "tiff", "webp"]
    )


def DirectoryOutput(label: str = "directory") -> Dict:
    """Output for saving to a directory"""
    return FileOutput(
        label, "Image Directory", ["directory"]
    )

def OnnxFileOutput() -> Dict:
    """Output for saving a .onnx file"""
    return FileOutput("onnx", "ONNX Model", ["onnx"])
