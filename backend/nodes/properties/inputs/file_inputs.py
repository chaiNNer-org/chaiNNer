from __future__ import annotations

import os

# pylint: disable=relative-beyond-top-level
from ...utils.image_utils import get_available_image_formats
from .base_input import BaseInput
from .generic_inputs import DropDownInput


class FileInput(BaseInput):
    """Input for submitting a local file"""

    def __init__(
        self,
        input_type: str,
        label: str,
        filetypes: list[str],
        has_handle: bool = False,
    ):
        super().__init__(f"file::{input_type}", label, has_handle)
        self.filetypes = filetypes

    def toDict(self):
        return {
            **super().toDict(),
            "filetypes": self.filetypes,
        }

    def enforce(self, value):
        assert os.path.exists(value), f"{value} does not exist"
        return value


def ImageFileInput() -> FileInput:
    """Input for submitting a local image file"""
    return FileInput(
        "image",
        "Image File",
        get_available_image_formats(),
        has_handle=False,
    )


def VideoFileInput() -> FileInput:
    """Input for submitting a local video file"""
    return FileInput(
        "video",
        "Video File",
        [".mp1", ".mp2", ".mp4", ".h264", ".hevc", ".webm", ".av1", "avi"],
        has_handle=False,
    )


def PthFileInput() -> FileInput:
    """Input for submitting a local .pth file"""
    return FileInput("pth", "Pretrained Model", [".pth"])


def TorchFileInput() -> FileInput:
    """Input for submitting a local .pth or .pt file"""
    return FileInput("pt", "Pretrained Model", [".pt"])


def DirectoryInput(
    label: str = "Base Directory", has_handle: bool = False
) -> FileInput:
    """Input for submitting a local directory"""
    return FileInput("directory", label, ["directory"], has_handle)


def ImageExtensionDropdown() -> DropDownInput:
    """Input for selecting file type from dropdown"""
    return DropDownInput(
        "Image Extension",
        [
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
        input_type="image-extensions",
    )


def BinFileInput() -> FileInput:
    """Input for submitting a local .bin file"""
    return FileInput("bin", "NCNN Bin File", [".bin"])


def ParamFileInput() -> FileInput:
    """Input for submitting a local .param file"""
    return FileInput("param", "NCNN Param File", [".param"])
