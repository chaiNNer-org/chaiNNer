from __future__ import annotations

import os
from typing import Dict

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
        hasHandle: bool = False,
        optional: bool = False,
    ):
        super().__init__(f"file::{input_type}", label, optional, hasHandle)
        self.filetypes = filetypes

    def toDict(self):
        return {
            "type": self.input_type,
            "label": self.label,
            "filetypes": self.filetypes,
            "hasHandle": self.hasHandle,
            "optional": self.optional,
        }

    def enforce(self, value):
        assert os.path.exists(value), f"{value} does not exist"
        return value


def ImageFileInput() -> Dict:
    """Input for submitting a local image file"""
    return FileInput(
        "image",
        "Image File",
        get_available_image_formats(),
        hasHandle=False,
    )


def VideoFileInput() -> Dict:
    """Input for submitting a local video file"""
    return FileInput(
        "video",
        "Video File",
        [".mp1", ".mp2", ".mp4", ".h264", ".hevc", ".webm", ".av1", "avi"],
        hasHandle=False,
    )


def PthFileInput() -> Dict:
    """Input for submitting a local .pth file"""
    return FileInput("pth", "Pretrained Model", [".pth"])


def TorchFileInput() -> Dict:
    """Input for submitting a local .pth or .pt file"""
    return FileInput("pt", "Pretrained Model", [".pt"])


def DirectoryInput(hasHandle: bool = False) -> Dict:
    """Input for submitting a local directory"""
    return FileInput("directory", "Base Directory", ["directory"], hasHandle)


def ImageExtensionDropdown() -> Dict:
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


def BinFileInput() -> Dict:
    """Input for submitting a local .bin file"""
    return FileInput("bin", "NCNN Bin File", [".bin"])


def ParamFileInput() -> Dict:
    """Input for submitting a local .param file"""
    return FileInput("param", "NCNN Param File", [".param"])
