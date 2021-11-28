from typing import Dict, List

import cv2

from .generic_inputs import DropDownInput


def ColorModeInput() -> Dict:
    """Converting color mode dropdown"""
    return DropDownInput(
        "generic",
        "Color Mode",
        [
            {
                "option": "BGR -> Gray",
                "value": cv2.COLOR_BGR2GRAY,
                "inputs": "numpy::2d:3c",
                "outputs": "numpy::2d:1c",
            },
            {
                "option": "Gray -> BGR",
                "value": cv2.COLOR_GRAY2BGR,
                "inputs": "numpy::2d:1c",
                "outputs": "np::2d:3c",
            },
            {
                "option": "BGR -> BGRA",
                "value": cv2.COLOR_BGR2BGRA,
                "inputs": "numpy::2d::3c",
                "outputs": "np::2d:4c",
            },
            {
                "option": "BGRA -> BGR",
                "value": cv2.COLOR_BGRA2BGR,
                "inputs": "numpy::2d::4c",
                "outputs": "np::2d:3c",
            },
            {
                "option": "BGRA -> Gray",
                "value": cv2.COLOR_BGRA2GRAY,
                "inputs": "numpy::2d::4c",
                "outputs": "np::2d:1c",
            },
        ],
    )


def InterpolationInput() -> Dict:
    """Resize interpolation dropdown"""
    return DropDownInput(
        "generic",
        "Interpolation Mode",
        [
            {
                "option": "Nearest Neighbor",
                "value": cv2.INTER_NEAREST,
            },
            {
                "option": "Box (Area)",
                "value": cv2.INTER_AREA,
            },
            {
                "option": "Linear",
                "value": cv2.INTER_LINEAR,
            },
            {
                "option": "Cubic",
                "value": cv2.INTER_CUBIC,
            },
            {
                "option": "Lanczos",
                "value": cv2.INTER_LANCZOS4,
            },
        ],
    )


def BorderInput() -> Dict:
    """CopyMakeBorder option dropdown"""
    return DropDownInput(
        "generic",
        "Border Type",
        [
            {
                "option": "Constant Color",
                "value": cv2.BORDER_CONSTANT,
            },
            {
                "option": "Replicate Edges",
                "value": cv2.BORDER_REPLICATE,
            },
            {
                "option": "Reflect (Mirror)",
                "value": cv2.BORDER_REFLECT101,
            },
            {
                "option": "Wrap (Tile)",
                "value": cv2.BORDER_WRAP,
            },
        ],
    )
