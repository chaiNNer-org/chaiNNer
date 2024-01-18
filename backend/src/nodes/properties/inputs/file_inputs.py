from __future__ import annotations

import os
from typing import Literal, Union

from api import BaseInput

# pylint: disable=relative-beyond-top-level
from ...impl.image_formats import get_available_image_formats

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
        input_type_name: str,
        label: str,
        file_kind: FileInputKind,
        filetypes: list[str],
        has_handle: bool = False,
        primary_input: bool = False,
    ):
        super().__init__(input_type_name, label, kind="file", has_handle=has_handle)
        self.filetypes = filetypes
        self.file_kind = file_kind
        self.primary_input = primary_input

        self.input_adapt = f"""
            match Input {{
                string as path => {input_type_name} {{ path: path }},
                _ => never
            }}
        """

        self.associated_type = str

    def to_dict(self):
        return {
            **super().to_dict(),
            "filetypes": self.filetypes,
            "fileKind": self.file_kind,
            "primaryInput": self.primary_input,
        }

    def enforce(self, value: object) -> str:
        if not isinstance(value, str):
            raise TypeError("value must be a string")
        if not os.path.exists(value):
            raise FileNotFoundError(f"File {value} does not exist")
        if not os.path.isfile(value):
            raise ValueError(f"The path {value} is not a file")
        return value


def ImageFileInput(primary_input: bool = False) -> FileInput:
    """Input for submitting a local image file"""
    return FileInput(
        input_type_name="ImageFile",
        label="Image File",
        file_kind="image",
        filetypes=get_available_image_formats(),
        has_handle=False,
        primary_input=primary_input,
    )


def VideoFileInput(primary_input: bool = False) -> FileInput:
    """Input for submitting a local video file"""
    return FileInput(
        input_type_name="VideoFile",
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
        primary_input=primary_input,
    )


def PthFileInput(primary_input: bool = False) -> FileInput:
    """Input for submitting a local .pth file"""
    return FileInput(
        input_type_name="PthFile",
        label="Model",
        file_kind="pth",
        filetypes=[".pt", ".pth", ".ckpt", ".safetensors"],
        primary_input=primary_input,
    )


class DirectoryInput(BaseInput):
    """Input for submitting a local directory"""

    def __init__(
        self,
        label: str = "Directory",
        has_handle: bool = True,
        must_exist: bool = True,
        hide_label: bool = False,
    ):
        super().__init__("Directory", label, kind="directory", has_handle=has_handle)

        self.input_adapt = """
            match Input {
                string as path => Directory { path: path },
                _ => never
            }
        """

        self.must_exist: bool = must_exist
        self.hide_label: bool = hide_label

        self.associated_type = str

    def to_dict(self):
        return {
            **super().to_dict(),
            "hideLabel": self.hide_label,
        }

    def enforce(self, value: object):
        if not isinstance(value, str):
            raise TypeError("value must be a string")
        if self.must_exist and not os.path.exists(value):
            raise FileNotFoundError(f"Directory {value} does not exist")
        return value


def BinFileInput(primary_input: bool = False) -> FileInput:
    """Input for submitting a local .bin file"""
    return FileInput(
        input_type_name="NcnnBinFile",
        label="NCNN Bin File",
        file_kind="bin",
        filetypes=[".bin"],
        primary_input=primary_input,
    )


def ParamFileInput(primary_input: bool = False) -> FileInput:
    """Input for submitting a local .param file"""
    return FileInput(
        input_type_name="NcnnParamFile",
        label="NCNN Param File",
        file_kind="param",
        filetypes=[".param"],
        primary_input=primary_input,
    )


def OnnxFileInput(primary_input: bool = False) -> FileInput:
    """Input for submitting a local .onnx file"""
    return FileInput(
        input_type_name="OnnxFile",
        label="ONNX Model File",
        file_kind="onnx",
        filetypes=[".onnx"],
        primary_input=primary_input,
    )
