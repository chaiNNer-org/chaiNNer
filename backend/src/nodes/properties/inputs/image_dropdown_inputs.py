import navi
from nodes.impl.upscale.basic_upscale import PaddingType

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
from .generic_inputs import DropDownGroup, DropDownInput, EnumInput


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
        categories=[
            DropDownGroup("Basic", start_at=ResizeFilter.AUTO),
            DropDownGroup("Advanced", start_at=ResizeFilter.HERMITE),
        ],
        option_labels={
            ResizeFilter.NEAREST: "Nearest Neighbor",
            ResizeFilter.BOX: "Area (Box)",
            ResizeFilter.CATROM: "Cubic",
            ResizeFilter.BSPLINE: "B-Spline",
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


def PaddingTypeInput() -> DropDownInput:
    return EnumInput(
        PaddingType,
        label="Padding",
        default=PaddingType.NONE,
        option_labels={
            PaddingType.REFLECT_MIRROR: "Reflect (Mirror)",
            PaddingType.WRAP: "Wrap (Tile)",
            PaddingType.REPLICATE: "Replicate Edges",
        },
    ).with_docs(
        "Adding padding to an image can eliminate artifacts at the edges of an image, at the cost of increasing processing time.",
        "**Always** use *Wrap (Tile)* when upscaling tiled images to avoid artifacts at the tile borders.",
        "For very small images (e.g. pixel art smaller 100x100px), use *Reflect (Mirror)* or *Replicate Edges* to increase the upscale quality.",
        hint=True,
    )
