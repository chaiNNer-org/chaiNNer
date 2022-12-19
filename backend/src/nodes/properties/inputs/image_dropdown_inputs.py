import cv2

# pylint: disable=relative-beyond-top-level
from ...impl.image_utils import BorderType
from ...impl.pil_utils import InterpolationMethod
from ...impl.tile import TileMode
from ...impl.color.convert_data import (
    color_spaces,
    color_spaces_or_detectors,
    is_alpha_partner,
    get_alpha_partner,
)
from ..expression import named
from .generic_inputs import DropDownInput, EnumInput


def ColorSpaceDetectorInput(label: str = "Color Space") -> DropDownInput:
    return DropDownInput(
        input_type="ColorSpace",
        label=label,
        options=[
            {
                "option": c.name,
                "value": c.id,
                "type": named("ColorSpace", {"channels": c.channels}),
            }
            for c in color_spaces_or_detectors
        ],
    )


def ColorSpaceInput(label: str = "Color Space") -> DropDownInput:
    return DropDownInput(
        input_type="ColorSpace",
        label=label,
        options=[
            {
                "option": c.name,
                "value": c.id,
                "type": named(
                    "ColorSpace",
                    {
                        "channels": c.channels,
                        "supportsAlpha": get_alpha_partner(c) is not None,
                    },
                ),
            }
            for c in color_spaces
            if not is_alpha_partner(c)
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


def ResizeToSideInput() -> DropDownInput:
    """Resize to side dropdown"""
    return DropDownInput(
        input_type="SideSelection",
        label="Resize To",
        options=[
            {
                "option": "Width",
                "value": "width",
                "type": "SideSelection::Width",
            },
            {
                "option": "Height",
                "value": "height",
                "type": "SideSelection::Height",
            },
            {
                "option": "Shorter Side",
                "value": "shorter side",
                "type": "SideSelection::Shorter",
            },
            {
                "option": "Longer Side",
                "value": "longer side",
                "type": "SideSelection::Longer",
            },
        ],
    )


def ResizeCondition() -> DropDownInput:
    """Upscale / Downscale condition dropdown"""
    return DropDownInput(
        input_type="ResizeCondition",
        label="Resize Condition",
        options=[
            {
                "option": "Upscale And Downscale",
                "value": "both",
                "type": "ResizeCondition::Both",
            },
            {
                "option": "Upscale Only",
                "value": "upscale",
                "type": "ResizeCondition::Upscale",
            },
            {
                "option": "Downscale Only",
                "value": "downscale",
                "type": "ResizeCondition::Downscale",
            },
        ],
    )


def RotateInterpolationInput() -> DropDownInput:
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


def BorderInput() -> DropDownInput:
    return EnumInput(
        BorderType,
        default_value=BorderType.REFLECT_MIRROR,
        option_labels={
            BorderType.REFLECT_MIRROR: "Reflect (Mirror)",
            BorderType.WRAP: "Wrap (Tile)",
            BorderType.REPLICATE: "Replicate Edges",
        },
        extra_definitions="""
            def BorderType::getOutputChannels(type: BorderType, channels: uint) {
                match type {
                    BorderType::Transparent => 4,
                    _ => channels
                }
            }
        """,
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


def TileModeInput():
    return DropDownInput(
        input_type="TileMode",
        label="Tile Mode",
        options=[
            {
                "option": "Tile",
                "value": TileMode.TILE,
            },
            {
                "option": "Mirror",
                "value": TileMode.MIRROR,
            },
        ],
    )


def NormalChannelInvertInput() -> DropDownInput:
    return DropDownInput(
        input_type="NormalChannelInvert",
        label="Invert",
        options=[
            {
                "option": "None",
                "value": 0,
            },
            {
                "option": "Invert R",
                "value": 1,
            },
            {
                "option": "Invert G",
                "value": 2,
            },
            {
                "option": "Invert R and G",
                "value": 3,
            },
        ],
    )
