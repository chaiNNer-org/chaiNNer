import navi

from ...impl.color.convert_data import (
    color_spaces,
    color_spaces_or_detectors,
    get_alpha_partner,
    is_alpha_partner,
)

# pylint: disable=relative-beyond-top-level
from ...impl.image_utils import BorderType
from ...impl.pil_utils import RotationInterpolationMethod
from ...impl.resize import ResizeFilter
from .generic_inputs import DropDownInput, EnumInput


def ColorSpaceDetectorInput(label: str = "Color Space") -> DropDownInput:
    return DropDownInput(
        input_type="ColorSpace",
        label=label,
        options=[
            {
                "option": c.name,
                "value": c.id,
                "type": navi.named("ColorSpace", {"channels": c.channels}),
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
                "type": navi.named(
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


def ResizeFilterInput() -> DropDownInput:
    return EnumInput(
        ResizeFilter,
        label="Interpolation Method",
        option_labels={
            ResizeFilter.NEAREST: "Nearest Neighbor",
            ResizeFilter.BOX: "Area (Box)",
            ResizeFilter.CATROM: "Cubic",
        },
    )


def RotateInterpolationInput() -> DropDownInput:
    return EnumInput(
        RotationInterpolationMethod,
        label="Interpolation Method",
        option_labels={
            RotationInterpolationMethod.NEAREST: "Nearest Neighbor",
        },
    )


def BorderInput() -> DropDownInput:
    return EnumInput(
        BorderType,
        default=BorderType.REFLECT_MIRROR,
        option_labels={
            BorderType.REFLECT_MIRROR: "Reflect (Mirror)",
            BorderType.WRAP: "Wrap (Tile)",
            BorderType.REPLICATE: "Replicate Edges",
        },
        extra_definitions="""
            def BorderType::getOutputChannels(type: BorderType, channels: uint, color: Color | null): uint {
                match type {
                    BorderType::Transparent => 4,
                    BorderType::CustomColor => match color {
                        Color => max(color.channels, channels),
                        null => never,
                    },
                    _ => channels
                }
            }
        """,
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
