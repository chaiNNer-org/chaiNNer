from __future__ import annotations

import os

# pylint: disable=relative-beyond-top-level
from ...utils.image_utils import get_available_image_formats
from .... import expression
from .base_input import BaseInput
from .generic_inputs import DropDownInput


class FileInput(BaseInput):
    """Input for submitting a local file"""

    def __init__(
        self,
        input_type: expression.ExpressionJson,
        label: str,
        filetypes: list[str],
        has_handle: bool = False,
    ):
        super().__init__(input_type, label, kind="file", has_handle=has_handle)
        self.filetypes = filetypes

    def toDict(self):
        return {
            **super().toDict(),
            "filetypes": self.filetypes,
        }

    def enforce(self, value):
        assert os.path.exists(value), f"File {value} does not exist"
        return value


def ImageFileInput() -> FileInput:
    """Input for submitting a local image file"""
    return FileInput(
        "ImageFile",
        "Image File",
        get_available_image_formats(),
        has_handle=False,
    )


def VideoFileInput() -> FileInput:
    """Input for submitting a local video file"""
    return FileInput(
        "VideoFile",
        "Video File",
        [".mp1", ".mp2", ".mp4", ".h264", ".hevc", ".webm", ".av1", "avi"],
        has_handle=False,
    )


def PthFileInput() -> FileInput:
    """Input for submitting a local .pth file"""
    return FileInput("PthFile", "Pretrained Model", [".pth"])


def TorchFileInput() -> FileInput:
    """Input for submitting a local .pth or .pt file"""
    return FileInput("PtFile", "Pretrained Model", [".pt"])


class DirectoryInput(BaseInput):
    """Input for submitting a local directory"""

    def __init__(self, label: str = "Base Directory", has_handle: bool = False):
        super().__init__("Directory", label, kind="directory", has_handle=has_handle)

    def enforce(self, value):
        assert os.path.exists(value), f"Directory {value} does not exist"
        return value


def ImageExtensionDropdown() -> DropDownInput:
    """Input for selecting file type from dropdown"""
    return DropDownInput(
        input_type="ImageExtension",
        label="Image Extension",
        options=[
            {
                "option": "PNG",
                "value": "png",
            },
            {
                "option": "JPG",
                "value": "jpg",
            },
            {
                "option": "GIF",
                "value": "gif",
            },
            {
                "option": "TIFF",
                "value": "tiff",
            },
            {
                "option": "WEBP",
                "value": "webp",
            },
        ],
    )


def BinFileInput() -> FileInput:
    """Input for submitting a local .bin file"""
    return FileInput("NcnnBinFile", "NCNN Bin File", [".bin"])


def ParamFileInput() -> FileInput:
    """Input for submitting a local .param file"""
    return FileInput("NcnnParamFile", "NCNN Param File", [".param"])


def OnnxFileInput() -> FileInput:
    """Input for submitting a local .onnx file"""
    return FileInput("OnnxFile", "ONNX Model File", [".onnx"], has_handle=True)
