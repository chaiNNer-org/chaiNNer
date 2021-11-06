from typing import Dict, List

from .generic_inputs import DropDownInput


def FileInput(
    input_type: str, label: str, accepts: List[str], filetypes: List[str]
) -> Dict:
    """ Input for submitting a local file """
    return {
        "type": f"file::{input_type}",
        "label": label,
        "accepts": None,
        "filetypes": filetypes,
    }


def ImageFileInput() -> Dict:
    """ Input for submitting a local image file """
    return FileInput(
        "image", "Image File", None, ["png", "jpg", "jpeg", "gif", "tiff", "webp"]
    )


def PthFileInput() -> Dict:
    """ Input for submitting a local .pth file """
    return FileInput("pth", "Pretrained Model", None, ["pth"])


def DirectoryInput() -> Dict:
    """ Input for submitting a local directory """
    return FileInput("directory", "Directory", None, ["directory"])


def ImageExtensionDropdown() -> Dict:
    """ Input for selecting file type from dropdown """
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
