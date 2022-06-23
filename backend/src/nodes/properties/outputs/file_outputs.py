from __future__ import annotations
from .base_output import BaseOutput
from .. import expression


class FileOutput(BaseOutput):
    """Output for saving a local file"""

    def __init__(self, file_type: expression.ExpressionJson, label: str):
        super().__init__(file_type, label)


def ImageFileOutput() -> FileOutput:
    """Output for saving a local image file"""
    return FileOutput("ImageFile", "Image File")


def DirectoryOutput() -> FileOutput:
    """Output for saving to a directory"""
    return FileOutput("Directory", "Image Directory")


def OnnxFileOutput() -> FileOutput:
    """Output for saving a .onnx file"""
    return FileOutput("OnnxFile", "ONNX Model File")
