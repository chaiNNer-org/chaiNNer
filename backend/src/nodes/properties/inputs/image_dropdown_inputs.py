import cv2

# pylint: disable=relative-beyond-top-level
from ...utils.pil_utils import InterpolationMethod
from .generic_inputs import DropDownInput
from .. import expression


def ColorModeInput() -> DropDownInput:
    """Converting color mode dropdown"""
    return DropDownInput(
        input_type="ColorMode",
        label="Color Mode",
        options=[
            {
                "option": "RGB -> Gray",
                "value": cv2.COLOR_BGR2GRAY,
                "type": expression.named(
                    "ColorMode", {"inputChannels": 3, "outputChannels": 1}
                ),
            },
            {
                "option": "Gray -> RGB",
                "value": cv2.COLOR_GRAY2BGR,
                "type": expression.named(
                    "ColorMode", {"inputChannels": 1, "outputChannels": 3}
                ),
            },
            {
                "option": "RGB -> RGBA",
                "value": cv2.COLOR_BGR2BGRA,
                "type": expression.named(
                    "ColorMode", {"inputChannels": 3, "outputChannels": 4}
                ),
            },
            {
                "option": "RGBA -> RGB",
                "value": cv2.COLOR_BGRA2BGR,
                "type": expression.named(
                    "ColorMode", {"inputChannels": 4, "outputChannels": 3}
                ),
            },
            {
                "option": "RGBA -> Gray",
                "value": cv2.COLOR_BGRA2GRAY,
                "type": expression.named(
                    "ColorMode", {"inputChannels": 4, "outputChannels": 1}
                ),
            },
            {
                "option": "RGB -> YUV",
                "value": cv2.COLOR_BGR2YUV,
                "type": expression.named(
                    "ColorMode", {"inputChannels": 3, "outputChannels": 3}
                ),
            },
            {
                "option": "YUV -> RGB",
                "value": cv2.COLOR_YUV2BGR,
                "type": expression.named(
                    "ColorMode", {"inputChannels": 3, "outputChannels": 3}
                ),
            },
            {
                "option": "RGB -> HSV",
                "value": cv2.COLOR_BGR2HSV,
                "type": expression.named(
                    "ColorMode", {"inputChannels": 3, "outputChannels": 3}
                ),
            },
            {
                "option": "HSV -> RGB",
                "value": cv2.COLOR_HSV2BGR,
                "type": expression.named(
                    "ColorMode", {"inputChannels": 3, "outputChannels": 3}
                ),
            },
        ],
    )


def InterpolationInput() -> DropDownInput:
    """Resize interpolation dropdown"""
    return DropDownInput(
        input_type="InterpolationMode",
        label="Interpolation Method",
        options=[
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
        input_type="RotateInterpolationMode",
        label="Interpolation Method",
        options=[
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
        input_type="BlurMode",
        label="Blur Mode",
        options=[
            {"option": "Box", "value": 0},
            {"option": "Blur", "value": 1},
            {"option": "Gaussian", "value": 2},
        ],
    )


def BorderInput() -> DropDownInput:
    """CopyMakeBorder option dropdown"""
    return DropDownInput(
        input_type="BorderType",
        label="Border Type",
        options=[
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
        input_type="ThresholdType",
        label="Threshold Type",
        options=[
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
        input_type="AdaptiveThresholdType",
        label="Threshold Type",
        options=[
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
        input_type="AdaptiveMethod",
        label="Adaptive Method",
        options=[
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
