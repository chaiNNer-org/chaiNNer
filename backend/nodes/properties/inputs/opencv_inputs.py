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
            {
                "option": "BGR -> YUV",
                "value": cv2.COLOR_BGR2YUV,
                "inputs": "numpy::2d::4c",
                "outputs": "np::2d:1c",
            },
            {
                "option": "YUV -> BGR",
                "value": cv2.COLOR_YUV2BGR,
                "inputs": "numpy::2d::4c",
                "outputs": "np::2d:1c",
            },
            {
                "option": "BGR -> HSV",
                "value": cv2.COLOR_BGR2HSV,
                "inputs": "numpy::2d::4c",
                "outputs": "np::2d:1c",
            },
            {
                "option": "HSV -> BGR",
                "value": cv2.COLOR_HSV2BGR,
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
                "option": "Area (Box)",
                "value": cv2.INTER_AREA,
            },
            {
                "option": "Nearest Neighbor",
                "value": cv2.INTER_NEAREST,
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


def BlurInput() -> Dict:
    """Blur option dropdown"""
    return DropDownInput(
        "generic",
        "Blur Mode",
        [
            {
                "option": "Box",
                "value": 0,
            },
            {
                "option": "Blur",
                "value": 1,
            },
            {
                "option": "Gaussian",
                "value": 2,
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
                "option": "Reflect (Mirror)",
                "value": cv2.BORDER_REFLECT101,
            },
            {
                "option": "Wrap (Tile)",
                "value": cv2.BORDER_WRAP,
            },
            {
                "option": "Replicate Edges",
                "value": cv2.BORDER_REPLICATE,
            },
            {
                "option": "Constant Color",
                "value": cv2.BORDER_CONSTANT,
            },
        ],
    )


def ThresholdInput() -> Dict:
    """Threshold type option dropdown"""
    return DropDownInput(
        "generic",
        "Threshold Type",
        [
            {
                "option": "Binary",
                "value": cv2.THRESH_BINARY,
            },
            {
                "option": "Binary (Inverted)",
                "value": cv2.THRESH_BINARY_INV,
            },
            {
                "option": "Truncated",
                "value": cv2.THRESH_TRUNC,
            },
            {
                "option": "To Zero",
                "value": cv2.THRESH_TOZERO,
            },
            {
                "option": "To Zero (Inverted)",
                "value": cv2.THRESH_TOZERO_INV,
            },
            {
                "option": "OTSU",
                "value": cv2.THRESH_OTSU,
            },
            {
                "option": "Triangle",
                "value": cv2.THRESH_TRIANGLE,
            },
            {
                "option": "Mask",
                "value": cv2.THRESH_MASK,
            },
        ],
    )


def AdaptiveThresholdInput() -> Dict:
    """Adaptive Threshold type option dropdown"""
    return DropDownInput(
        "generic",
        "Threshold Type",
        [
            {
                "option": "Binary",
                "value": cv2.THRESH_BINARY,
            },
            {
                "option": "Binary (Inverted)",
                "value": cv2.THRESH_BINARY_INV,
            },
        ],
    )


def AdaptiveMethodInput() -> Dict:
    """Adaptive method border option dropdown"""
    return DropDownInput(
        "generic",
        "Adaptive Method",
        [
            {
                "option": "Replicate Edges",
                "value": cv2.BORDER_REPLICATE,
            },
            {
                "option": "Isolated",
                "value": cv2.BORDER_ISOLATED,
            },
        ],
    )
