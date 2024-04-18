from __future__ import annotations

from pathlib import Path
from typing import Literal, Union

import navi
from api import BaseInput

# pylint: disable=relative-beyond-top-level
from ...impl.image_formats import get_available_image_formats
from .label import LabelStyle

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
        label: str,
        file_kind: FileInputKind,
        filetypes: list[str],
        has_handle: bool = False,
        primary_input: bool = False,
    ):
        super().__init__(
            navi.named("File", {"kind": navi.literal(file_kind)}),
            label,
            kind="file",
            has_handle=has_handle,
        )
        self.filetypes = filetypes
        self.file_kind = file_kind
        self.primary_input = primary_input

        self.input_adapt = """
            match Input {
                string as path => File { path: path },
                _ => never
            }
        """

        self.associated_type = Path

    def to_dict(self):
        return {
            **super().to_dict(),
            "filetypes": self.filetypes,
            "fileKind": self.file_kind,
            "primaryInput": self.primary_input,
        }

    def enforce(self, value: object) -> Path:
        if isinstance(value, str):
            value = Path(value)
        assert isinstance(value, Path)
        assert value.exists(), f"File {value} does not exist"
        assert value.is_file(), f"The path {value} is not a file"
        return value


def ImageFileInput(primary_input: bool = False) -> FileInput:
    """Input for submitting a local image file"""
    return FileInput(
        label="Image File",
        file_kind="image",
        filetypes=get_available_image_formats(),
        has_handle=False,
        primary_input=primary_input,
    )


def VideoFileInput(primary_input: bool = False) -> FileInput:
    """Input for submitting a local video file"""
    return FileInput(
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
        create: bool = False,
        label_style: LabelStyle = "default",
    ):
        super().__init__("Directory", label, kind="directory", has_handle=has_handle)

        self.input_adapt = """
            match Input {
                string as path => Directory { path: path },
                _ => never
            }
        """

        self.must_exist: bool = must_exist
        self.create: bool = create
        self.label_style: LabelStyle = label_style

        self.associated_type = Path

    def to_dict(self):
        return {
            **super().to_dict(),
            "labelStyle": self.label_style,
        }

    def enforce(self, value: object):
        if isinstance(value, str):
            value = Path(value)
        assert isinstance(value, Path)

        if self.create:
            value.mkdir(parents=True, exist_ok=True)
        elif self.must_exist:
            assert value.exists(), f"Directory {value} does not exist"

        return value


def BinFileInput(primary_input: bool = False) -> FileInput:
    """Input for submitting a local .bin file"""
    return FileInput(
        label="NCNN Bin File",
        file_kind="bin",
        filetypes=[".bin"],
        primary_input=primary_input,
    )


def ParamFileInput(primary_input: bool = False) -> FileInput:
    """Input for submitting a local .param file"""
    return FileInput(
        label="NCNN Param File",
        file_kind="param",
        filetypes=[".param"],
        primary_input=primary_input,
    )


def OnnxFileInput(primary_input: bool = False) -> FileInput:
    """Input for submitting a local .onnx file"""
    return FileInput(
        label="ONNX Model File",
        file_kind="onnx",
        filetypes=[".onnx"],
        primary_input=primary_input,
    )
