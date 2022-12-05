from __future__ import annotations
from typing import Literal, Union

import os

# pylint: disable=relative-beyond-top-level
from ...utils.image_utils import get_available_image_formats
from .. import expression
from .base_input import BaseInput
from .generic_inputs import DropDownInput

FileInputKind = Union[
    Literal["bin"],
    Literal["image"],
    Literal["onnx"],
    Literal["param"],
    Literal["pt"],
    Literal["pth"],
    Literal["video"],
]


class FileInput(BaseInput):
    """Input for submitting a local file"""

    def __init__(
        self,
        input_type: expression.ExpressionJson,
        label: str,
        file_kind: FileInputKind,
        filetypes: list[str],
        has_handle: bool = False,
        primary_input: bool = False,
    ):
        super().__init__(input_type, label, kind="file", has_handle=has_handle)
        self.filetypes = filetypes
        self.file_kind = file_kind
        self.primary_input = primary_input

    def toDict(self):
        return {
            **super().toDict(),
            "filetypes": self.filetypes,
            "fileKind": self.file_kind,
            "primaryInput": self.primary_input,
        }

    def enforce(self, value) -> str:
        assert isinstance(value, str)
        assert os.path.exists(value), f"File {value} does not exist"
        assert os.path.isfile(value), f"The path {value} is not a file"
        return value


def ImageFileInput(primary_input: bool = False) -> FileInput:
    """Input for submitting a local image file"""
    return FileInput(
        input_type="ImageFile",
        label="Image File",
        file_kind="image",
        filetypes=get_available_image_formats(),
        has_handle=False,
        primary_input=primary_input,
    )


def VideoFileInput() -> FileInput:
    """Input for submitting a local video file"""
    return FileInput(
        input_type="VideoFile",
        label="Video File",
        file_kind="video",
        filetypes=[
            ".mp4",
            ".h264",
            ".hevc",
            ".webm",
            ".avi",
            ".gif",
            ".mov",
            ".mkv",
            ".flv",
            ".m4v",
            ".avs",
        ],
        has_handle=False,
    )


def PthFileInput(primary_input: bool = False) -> FileInput:
    """Input for submitting a local .pth file"""
    return FileInput(
        input_type="PthFile",
        label="Pretrained Model",
        file_kind="pth",
        filetypes=[".pth"],
        primary_input=primary_input,
    )


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
            {
                "option": "WEBP (Lossless)",
                "value": "webp-lossless",
            },
            {
                "option": "TGA",
                "value": "tga",
            },
        ],
    )


def BinFileInput(primary_input: bool = False) -> FileInput:
    """Input for submitting a local .bin file"""
    return FileInput(
        input_type="NcnnBinFile",
        label="NCNN Bin File",
        file_kind="bin",
        filetypes=[".bin"],
        primary_input=primary_input,
    )


def ParamFileInput(primary_input: bool = False) -> FileInput:
    """Input for submitting a local .param file"""
    return FileInput(
        input_type="NcnnParamFile",
        label="NCNN Param File",
        file_kind="param",
        filetypes=[".param"],
        primary_input=primary_input,
    )


def OnnxFileInput(primary_input: bool = False) -> FileInput:
    """Input for submitting a local .onnx file"""
    return FileInput(
        input_type="OnnxFile",
        label="ONNX Model File",
        file_kind="onnx",
        filetypes=[".onnx"],
        primary_input=primary_input,
    )
