from __future__ import annotations

import os
from typing import Literal, Union

# pylint: disable=relative-beyond-top-level
from ...impl.image_formats import get_available_image_formats
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
        label="Pretrained Model",
        file_kind="pth",
        filetypes=[".pt", ".pth"],
        primary_input=primary_input,
    )


def CkptFileInput(primary_input: bool = False) -> FileInput:
    """Input for submitting a local stable diffusion checkpoint file"""
    return FileInput(
        input_type_name="CkptFile",
        label="Stable Diffusion Checkpoint",
        file_kind="ckpt",
        filetypes=[".ckpt", ".safetensors", ".pth"],
        primary_input=primary_input,
    )


def StableDiffusionPtFileInput(primary_input: bool = False) -> FileInput:
    """Input for submitting a local stable diffusion CLIP or VAE model file"""
    return FileInput(
        input_type_name="StableDiffusionPtFile",
        label="Model",
        file_kind="pt",
        filetypes=[".ckpt", ".pt", ".bin", ".pth", ".safetensors"],
        primary_input=primary_input,
    )


class DirectoryInput(BaseInput):
    """Input for submitting a local directory"""

    def __init__(self, label: str = "Base Directory", has_handle: bool = False):
        super().__init__("Directory", label, kind="directory", has_handle=has_handle)

        self.input_adapt = """
            match Input {
                string as path => Directory { path: path },
                _ => never
            }
        """

    def enforce(self, value):
        assert isinstance(value, str)
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
            {
                "option": "DDS",
                "value": "dds",
            },
        ],
    )


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
