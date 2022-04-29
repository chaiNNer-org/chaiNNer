from typing import Dict

from ...utils.image_utils import get_available_image_formats
from .generic_inputs import DropDownInput


def FileInput(
    input_type: str,
    label: str,
    accepts: list[str],
    filetypes: list[str],
    hasHandle: bool = False,
) -> Dict:
    """Input for submitting a local file"""
    return {
        "type": f"file::{input_type}",
        "label": label,
        "accepts": None,
        "filetypes": filetypes,
        "hasHandle": hasHandle,
    }


def ImageFileInput() -> Dict:
    """Input for submitting a local image file"""
    return FileInput(
        "image",
        "Image File",
        None,
        get_available_image_formats(),
        hasHandle=False,
    )


def PthFileInput() -> Dict:
    """Input for submitting a local .pth file"""
    return FileInput("pth", "Pretrained Model", None, ["pth"])


def TorchFileInput() -> Dict:
    """Input for submitting a local .pth or .pt file"""
    return FileInput("pt", "Pretrained Model", None, ["pt"])


def DirectoryInput(hasHandle: bool = False) -> Dict:
    """Input for submitting a local directory"""
    return FileInput("directory", "Base Directory", None, ["directory"], hasHandle)


def ImageExtensionDropdown() -> Dict:
    """Input for selecting file type from dropdown"""
    return DropDownInput(
        "image-extensions",
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
    )


def BinFileInput() -> Dict:
    """Input for submitting a local .bin file"""
    return FileInput("bin", "NCNN Bin File", None, ["bin"])


def ParamFileInput() -> Dict:
    """Input for submitting a local .param file"""
    return FileInput("param", "NCNN Param File", None, ["param"])


def OnnxFileInput() -> Dict:
    """Input for submitting a local .onnx file"""
    return FileInput("param", "NCNN Param File", None, ["param"])
