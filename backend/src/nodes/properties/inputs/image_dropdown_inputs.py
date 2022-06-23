import cv2

# pylint: disable=relative-beyond-top-level
from ...utils.pil_utils import InterpolationMethod
from .generic_inputs import DropDownInput


def ColorModeInput() -> DropDownInput:
    """Converting color mode dropdown"""
    return DropDownInput(
        "Color Mode",
        [
            {
                "option": "RGB -> Gray",
                "value": cv2.COLOR_BGR2GRAY,
                "inputs": "numpy::2d:3c",
                "outputs": "numpy::2d:1c",
            },
            {
                "option": "Gray -> RGB",
                "value": cv2.COLOR_GRAY2BGR,
                "inputs": "numpy::2d:1c",
                "outputs": "np::2d:3c",
            },
            {
                "option": "RGB -> RGBA",
                "value": cv2.COLOR_BGR2BGRA,
                "inputs": "numpy::2d::3c",
                "outputs": "np::2d:4c",
            },
            {
                "option": "RGBA -> RGB",
                "value": cv2.COLOR_BGRA2BGR,
                "inputs": "numpy::2d::4c",
                "outputs": "np::2d:3c",
            },
            {
                "option": "RGBA -> Gray",
                "value": cv2.COLOR_BGRA2GRAY,
                "inputs": "numpy::2d::4c",
                "outputs": "np::2d:1c",
            },
            {
                "option": "RGB -> YUV",
                "value": cv2.COLOR_BGR2YUV,
                "inputs": "numpy::2d::4c",
                "outputs": "np::2d:1c",
            },
            {
                "option": "YUV -> RGB",
                "value": cv2.COLOR_YUV2BGR,
                "inputs": "numpy::2d::4c",
                "outputs": "np::2d:1c",
            },
            {
                "option": "RGB -> HSV",
                "value": cv2.COLOR_BGR2HSV,
                "inputs": "numpy::2d::4c",
                "outputs": "np::2d:1c",
            },
            {
                "option": "HSV -> RGB",
                "value": cv2.COLOR_HSV2BGR,
                "inputs": "numpy::2d::4c",
                "outputs": "np::2d:1c",
            },
        ],
    )


def InterpolationInput() -> DropDownInput:
    """Resize interpolation dropdown"""
    return DropDownInput(
        "Interpolation Method",
        [
            {
                "option": "Auto",
                "value": InterpolationMethod.AUTO,
            },
            {
                "option": "Nearest Neighbor",
                "value": InterpolationMethod.NEAREST,
            },
            {
                "option": "Area (Box)",
                "value": InterpolationMethod.BOX,
            },
            {
                "option": "Linear",
                "value": InterpolationMethod.LINEAR,
            },
            {
                "option": "Cubic",
                "value": InterpolationMethod.CUBIC,
            },
            {
                "option": "Lanczos",
                "value": InterpolationMethod.LANCZOS,
            },
        ],
    )


def RotateInterpolationInput() -> DropDownInput:
    """Rotate interpolation dropdown"""
    return DropDownInput(
        "Interpolation Method",
        [
            {
                "option": "Cubic",
                "value": InterpolationMethod.CUBIC,
            },
            {
                "option": "Linear",
                "value": InterpolationMethod.LINEAR,
            },
            {
                "option": "Nearest Neighbor",
                "value": InterpolationMethod.NEAREST,
            },
        ],
    )


def BlurInput() -> DropDownInput:
    """Blur option dropdown"""
    return DropDownInput(
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


def BorderInput() -> DropDownInput:
    """CopyMakeBorder option dropdown"""
    return DropDownInput(
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
            {
                "option": "Transparent",
                "value": cv2.BORDER_TRANSPARENT,
            },
        ],
    )


def ThresholdInput() -> DropDownInput:
    """Threshold type option dropdown"""
    return DropDownInput(
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
        ],
    )


def AdaptiveThresholdInput() -> DropDownInput:
    """Adaptive Threshold type option dropdown"""
    return DropDownInput(
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


def AdaptiveMethodInput() -> DropDownInput:
    """Adaptive method border option dropdown"""
    return DropDownInput(
        "Adaptive Method",
        [
            {
                "option": "Mean - C",
                "value": cv2.ADAPTIVE_THRESH_MEAN_C,
            },
            {
                "option": "Gaussian - C",
                "value": cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            },
        ],
    )
