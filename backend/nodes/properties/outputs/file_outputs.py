from __future__ import annotations
from .base_output import BaseOutput


class FileOutput(BaseOutput):
    """Output for saving a local file"""

    def __init__(self, file_type: str, label: str):
        super().__init__(f"file::{file_type}", label)


def ImageFileOutput(file_type: str = "image") -> FileOutput:
    """Output for saving a local image file"""
    return FileOutput(file_type, "Image File")


def DirectoryOutput(file_type: str = "directory") -> FileOutput:
    """Output for saving to a directory"""
    return FileOutput(file_type, "Image Directory")


def OnnxFileOutput() -> FileOutput:
    """Output for saving a .onnx file"""
    return FileOutput("onnx", "ONNX Model")
