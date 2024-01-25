from __future__ import annotations

import json
import re
from dataclasses import dataclass
from enum import Enum
from typing import Any, Generic, Literal, TypedDict, TypeVar

import numpy as np
from sanic.log import logger
from typing_extensions import NotRequired

import navi
from api import BaseInput, InputConversion, group

from ...condition import Condition, ConditionJson
from ...impl.blend import BlendMode
from ...impl.color.color import Color
from ...impl.dds.format import DDSFormat
from ...impl.image_utils import FillColor, normalize
from ...impl.upscale.auto_split_tiles import TileSize
from ...utils.format import format_color_with_channels
from ...utils.seed import Seed
from ...utils.utils import (
    join_pascal_case,
    join_space_case,
    split_pascal_case,
    split_snake_case,
)
from .label import LabelStyle
from .numeric_inputs import NumberInput


class DropDownOption(TypedDict):
    option: str
    value: str | int
    type: NotRequired[navi.ExpressionJson]
    condition: NotRequired[ConditionJson | None]


DropDownStyle = Literal["dropdown", "checkbox", "tabs"]
"""
This specified the preferred style in which the frontend may display the dropdown.

- `dropdown`: This is the default style. The dropdown will simply be displayed as a dropdown.
- `checkbox`: If the dropdown has 2 options, then it will be displayed as a checkbox.
  The first option will be interpreted as the yes/true option while the second option will be interpreted as the no/false option.
- `tabs`: The options are displayed as tab list. The label of the input itself will *not* be displayed.
"""


@dataclass
class DropDownGroup:
    label: str | None
    start_at: str | int | Enum

    @staticmethod
    def divider(start_at: str | int | Enum):
        return DropDownGroup(None, start_at)

    def to_dict(self):
        start_at = self.start_at
        if isinstance(start_at, Enum):
            start_at = start_at.value
        return {"label": self.label, "startAt": start_at}


class DropDownInput(BaseInput):
    """Input for a dropdown"""

    def __init__(
        self,
        input_type: navi.ExpressionJson,
        label: str,
        options: list[DropDownOption],
        default_value: str | int | None = None,
        preferred_style: DropDownStyle = "dropdown",
        label_style: LabelStyle = "default",
        groups: list[DropDownGroup] | None = None,
        associated_type: Any = None,
    ):
        super().__init__(input_type, label, kind="dropdown", has_handle=False)
        self.options = options
        self.accepted_values = {o["value"] for o in self.options}
        self.default = (
            default_value if default_value is not None else options[0]["value"]
        )
        self.preferred_style: DropDownStyle = preferred_style
        self.label_style: LabelStyle = label_style
        self.groups: list[DropDownGroup] = groups or []

        if self.default not in self.accepted_values:
            logger.error(
                f"Invalid default value {self.default} in {label} dropdown. Using first value instead."
            )
            self.default = options[0]["value"]

        self.associated_type = (
            associated_type if associated_type is not None else type(self.default)
        )

    def to_dict(self):
        return {
            **super().to_dict(),
            "options": self.options,
            "def": self.default,
            "preferredStyle": self.preferred_style,
            "labelStyle": self.label_style,
            "groups": [c.to_dict() for c in self.groups],
        }

    def make_optional(self):
        raise ValueError("DropDownInput cannot be made optional")

    def enforce(self, value: object):
        assert value in self.accepted_values, f"{value} is not a valid option"
        return value

    def wrap_with_conditional_group(self):
        """
        Adds a conditional group around the dropdown input according to the conditions of its options.

        Note: Calling this method is only valid if all options have a condition.
        """

        conditions: list[ConditionJson] = []
        for option in self.options:
            c = option.get("condition")
            if c is None:
                raise ValueError(
                    f"wrap_with_conditional is unnecessary, because the {option['option']} option has no condition."
                )
            conditions.append(c)

        condition: ConditionJson = {"kind": "or", "items": conditions}

        return group("conditional", {"condition": condition})(self)


class BoolInput(DropDownInput):
    def __init__(self, label: str, default: bool = True):
        super().__init__(
            input_type="bool",
            label=label,
            default_value=int(default),
            options=[
                {
                    "option": "Yes",
                    "value": int(True),  # 1
                    "type": "true",
                },
                {
                    "option": "No",
                    "value": int(False),  # 0
                    "type": "false",
                },
            ],
            preferred_style="checkbox",
        )
        self.associated_type = bool

    def enforce(self, value: object) -> bool:
        value = super().enforce(value)
        return bool(value)


T = TypeVar("T", bound=Enum)


class EnumInput(Generic[T], DropDownInput):
    """
    This adapts a python Enum into a chaiNNer dropdown input.

    ### Features

    All variants of the enum will be converted into typed dropdown options.
    The dropdown will be fully typed and bring its own type definitions.
    Option labels can be (partially) overridden using `option_labels`.

    By default, the input label, type names, and option labels will all be generated from the enum name and variant names.
    All of those defaults can be overridden.

    Options will be ordered by declaration order in the python enum definition.

    ### Requirements

    The value of each variant has to be either `str` or `int`.
    Other types are not permitted.
    """

    def __init__(
        self,
        enum: type[T],
        label: str | None = None,
        default: T | None = None,
        type_name: str | None = None,
        option_labels: dict[T, str] | None = None,
        extra_definitions: str | None = None,
        preferred_style: DropDownStyle = "dropdown",
        label_style: LabelStyle = "default",
        categories: list[DropDownGroup] | None = None,
        conditions: dict[T, Condition] | None = None,
    ):
        if type_name is None:
            type_name = enum.__name__
        if label is None:
            label = join_space_case(split_pascal_case(type_name))
        if option_labels is None:
            option_labels = {}
        if conditions is None:
            conditions = {}

        options: list[DropDownOption] = []
        variant_types: list[str] = []
        for variant in enum:
            value = variant.value
            assert isinstance(value, (int, str))
            assert (
                re.match(r"^[a-zA-Z_][a-zA-Z0-9_]*$", variant.name) is not None
            ), f"Expected the name of {enum.__name__}.{variant.name} to be snake case."

            name = split_snake_case(variant.name)
            variant_type = f"{type_name}::{join_pascal_case(name)}"
            option_label = option_labels.get(variant, join_space_case(name))
            condition = conditions.get(variant)
            if condition is not None:
                condition = condition.to_json()

            variant_types.append(variant_type)

            options.append(
                {
                    "option": option_label,
                    "value": value,
                    "type": variant_type,
                    "condition": condition,
                }
            )

        super().__init__(
            input_type=type_name,
            label=label,
            options=options,
            default_value=default.value if default is not None else None,
            preferred_style=preferred_style,
            label_style=label_style,
            groups=categories,
        )

        self.type_definitions = (
            f"let {type_name} = {' | '.join(variant_types)};\n"
            + "\n".join([f"struct {t};" for t in variant_types])
            + (extra_definitions or "")
        )
        self.type_name: str = type_name
        self.enum = enum

        self.associated_type = enum

    def enforce(self, value: object) -> T:
        value = super().enforce(value)
        return self.enum(value)


class TextInput(BaseInput):
    """Input for arbitrary text"""

    def __init__(
        self,
        label: str,
        has_handle: bool = True,
        min_length: int = 0,
        max_length: int | None = None,
        placeholder: str | None = None,
        multiline: bool = False,
        allow_numbers: bool = True,
        default: str | None = None,
        label_style: LabelStyle = "default",
        allow_empty_string: bool = False,
    ):
        super().__init__(
            input_type="string" if min_length == 0 else 'invStrSet("")',
            label=label,
            has_handle=has_handle,
            kind="text",
        )
        self.min_length = min_length
        self.max_length = max_length
        self.placeholder = placeholder
        self.default = default
        self.multiline = multiline
        self.label_style: LabelStyle = label_style
        self.allow_empty_string = allow_empty_string

        if default is not None:
            assert default != ""
            assert min_length < len(default)
            assert max_length is None or len(default) < max_length

        self.associated_type = str

        if allow_numbers:
            self.input_conversions = [InputConversion("number", "toString(Input)")]

    def enforce(self, value: object) -> str:
        if isinstance(value, float) and int(value) == value:
            # stringify integers values
            value = str(int(value))
        else:
            value = str(value)

        # enforce length range
        if self.max_length is not None and len(value) > self.max_length:
            value = value[: self.max_length]
        if len(value) < self.min_length:
            raise ValueError(
                f"Text value of input '{self.label}' must be at least {self.min_length} characters long,"
                f" but found {len(value)} ('{value}')."
            )

        return value

    def to_dict(self):
        return {
            **super().to_dict(),
            "minLength": self.min_length,
            "maxLength": self.max_length,
            "placeholder": self.placeholder,
            "multiline": self.multiline,
            "def": self.default,
            "labelStyle": self.label_style,
            "allowEmptyString": self.allow_empty_string,
        }


class ClipboardInput(BaseInput):
    """Input for pasting from clipboard"""

    def __init__(self, label: str = "Clipboard input"):
        super().__init__(["Image", "string", "number"], label, kind="text")
        self.input_conversions = [InputConversion("Image", '"<Image>"')]

    def enforce(self, value: object):
        if isinstance(value, np.ndarray):
            return normalize(value)

        if isinstance(value, float) and int(value) == value:
            # stringify integers values
            return str(int(value))

        return str(value)


class AnyInput(BaseInput):
    def __init__(self, label: str):
        super().__init__(input_type="any", label=label)
        self.associated_type = object

    def enforce_(self, value: object):
        # The behavior for optional inputs and None makes sense for all inputs except this one.
        return value


class SeedInput(NumberInput):
    def __init__(self, label: str = "Seed", has_handle: bool = True):
        super().__init__(
            label=label,
            minimum=None,
            maximum=None,
            precision=0,
            default=0,
            label_style="default",
        )
        self.has_handle = has_handle

        self.input_type = "Seed | int"
        self.input_conversions = [InputConversion("int", "Seed")]
        self.input_adapt = """
            match Input {
                int => Seed,
                _ => never
            }
        """

        self.associated_type = Seed

    def enforce(self, value: object) -> Seed:
        if isinstance(value, Seed):
            return value
        if isinstance(value, (int, float, str)):
            return Seed(int(value))
        raise ValueError(f"Cannot convert {value} to Seed")

    def make_optional(self):
        raise ValueError("SeedInput cannot be made optional")


class ColorInput(BaseInput):
    def __init__(
        self,
        label: str = "Color",
        default: Color | None = None,
        channels: int | list[int] | None = None,
    ):
        super().__init__(
            input_type=navi.Color(channels=channels),
            label=label,
            has_handle=True,
            kind="color",
        )

        self.input_adapt = """
            match Input {
                string => parseColorJson(Input),
                _ => never
            }
        """

        self.channels: list[int] | None = (
            [channels] if isinstance(channels, int) else channels
        )

        if self.channels is None:
            if default is None:
                default = Color.bgr((0.5, 0.5, 0.5))
        else:
            assert len(self.channels) >= 0
            if default is None:
                if 3 in self.channels:
                    default = Color.bgr((0.5, 0.5, 0.5))
                elif 4 in self.channels:
                    default = Color.bgra((0.5, 0.5, 0.5, 1))
                elif 1 in self.channels:
                    default = Color.gray(0.5)
                else:
                    raise ValueError("Cannot find default color value")
            else:
                assert (
                    default.channels in self.channels
                ), "The default color is not accepted."

        self.default: Color = default

        self.associated_type = Color

    def enforce(self, value: object) -> Color:
        if isinstance(value, str):
            # decode color JSON strings from the frontend
            value = Color.from_json(json.loads(value))

        assert isinstance(value, Color)

        if self.channels is not None and value.channels not in self.channels:
            expected = format_color_with_channels(self.channels, plural=True)
            actual = format_color_with_channels([value.channels])
            raise ValueError(
                f"The input {self.label} only supports {expected} but was given {actual}."
            )

        return value

    def to_dict(self):
        return {
            **super().to_dict(),
            "def": json.dumps(self.default.to_json()),
            "channels": self.channels,
        }

    def make_optional(self):
        raise ValueError("ColorInput cannot be made optional")


class VideoContainer(Enum):
    MKV = "mkv"
    MP4 = "mp4"
    MOV = "mov"
    WEBM = "webm"
    AVI = "avi"
    GIF = "gif"


VIDEO_CONTAINERS = {
    VideoContainer.MKV: "mkv",
    VideoContainer.MP4: "mp4",
    VideoContainer.MOV: "mov",
    VideoContainer.WEBM: "WebM",
    VideoContainer.AVI: "avi",
    VideoContainer.GIF: "GIF",
}


VIDEO_FFV1_CONTAINERS: list[VideoContainer] = [VideoContainer.MKV]


def VideoFfv1ContainerDropdown() -> DropDownInput:
    return DropDownInput(
        input_type="VideoContainer",
        label="Container",
        label_style="inline",
        options=[
            {"option": VIDEO_CONTAINERS[vc], "value": vc.value}
            for vc in VIDEO_FFV1_CONTAINERS
        ],
        associated_type=VideoContainer,
    )


VIDEO_VP9_CONTAINERS: list[VideoContainer] = [
    VideoContainer.WEBM,
    VideoContainer.MP4,
    VideoContainer.MKV,
]


def VideoVp9ContainerDropdown() -> DropDownInput:
    return DropDownInput(
        input_type="VideoContainer",
        label="Container",
        label_style="inline",
        options=[
            {"option": VIDEO_CONTAINERS[vc], "value": vc.value}
            for vc in VIDEO_VP9_CONTAINERS
        ],
        associated_type=VideoContainer,
    )


VIDEO_H264_CONTAINERS: list[VideoContainer] = [
    VideoContainer.MKV,
    VideoContainer.MP4,
    VideoContainer.MOV,
    VideoContainer.AVI,
]


def VideoH264ContainerDropdown() -> DropDownInput:
    return DropDownInput(
        input_type="VideoContainer",
        label="Container",
        label_style="inline",
        options=[
            {"option": VIDEO_CONTAINERS[vc], "value": vc.value}
            for vc in VIDEO_H264_CONTAINERS
        ],
        associated_type=VideoContainer,
    )


VIDEO_H265_CONTAINERS: list[VideoContainer] = [
    VideoContainer.MKV,
    VideoContainer.MP4,
    VideoContainer.MOV,
]


def VideoH265ContainerDropdown() -> DropDownInput:
    return DropDownInput(
        input_type="VideoContainer",
        label="Container",
        label_style="inline",
        options=[
            {"option": VIDEO_CONTAINERS[vc], "value": vc.value}
            for vc in VIDEO_H265_CONTAINERS
        ],
        associated_type=VideoContainer,
    )


class VideoEncoder(Enum):
    H264 = "libx264"
    H265 = "libx265"
    VP9 = "libvpx-vp9"
    FFV1 = "ffv1"


VIDEO_ENCODER_LABELS = {
    VideoEncoder.H264: "H.264 (AVC)",
    VideoEncoder.H265: "H.265 (HEVC)",
    VideoEncoder.VP9: "VP9",
    VideoEncoder.FFV1: "FFV1",
}


def VideoEncoderDropdown() -> DropDownInput:
    return DropDownInput(
        input_type="VideoEncoder",
        label="Encoder",
        label_style="inline",
        options=[
            {"option": label, "value": vc.value}
            for vc, label in VIDEO_ENCODER_LABELS.items()
        ],
        default_value=VideoEncoder.H264.value,
        associated_type=VideoEncoder,
    )


def VideoPresetDropdown() -> DropDownInput:
    """Video Type option dropdown"""
    return DropDownInput(
        input_type="VideoPreset",
        label="Preset",
        label_style="inline",
        options=[
            {"option": "ultrafast", "value": "ultrafast"},
            {"option": "superfast", "value": "superfast"},
            {"option": "veryfast", "value": "veryfast"},
            {"option": "fast", "value": "fast"},
            {"option": "medium", "value": "medium"},
            {"option": "slow", "value": "slow"},
            {"option": "slower", "value": "slower"},
            {"option": "veryslow", "value": "veryslow"},
        ],
    )


def BlendModeDropdown() -> DropDownInput:
    """Blending Mode option dropdown"""
    return EnumInput(
        BlendMode,
        option_labels={
            BlendMode.ADD: "Linear Dodge (Add)",
        },
        categories=[
            DropDownGroup.divider(start_at=BlendMode.DARKEN),
            DropDownGroup.divider(start_at=BlendMode.LIGHTEN),
            DropDownGroup.divider(start_at=BlendMode.OVERLAY),
            DropDownGroup.divider(start_at=BlendMode.DIFFERENCE),
        ],
    )


def FillColorDropdown() -> DropDownInput:
    return EnumInput(
        FillColor,
        label="Negative Space Fill",
        default=FillColor.AUTO,
        extra_definitions="""
            def FillColor::getOutputChannels(fill: FillColor, channels: uint) {
                match fill {
                    FillColor::Transparent => 4,
                    _ => channels
                }
            }
        """,
    )


def TileSizeDropdown(
    label: str = "Tile Size", estimate: bool = True, default: TileSize | None = None
) -> DropDownInput:
    options = []
    if estimate:
        options.append({"option": "Auto (estimate)", "value": 0})

    options.append({"option": "Maximum", "value": -2})
    options.append({"option": "No Tiling", "value": -1})

    for size in [128, 192, 256, 384, 512, 768, 1024, 2048, 4096]:
        options.append({"option": str(size), "value": size})

    return DropDownInput(
        input_type="TileSize",
        label=label,
        options=options,
        associated_type=TileSize,
        default_value=default,
    )


SUPPORTED_DDS_FORMATS: list[tuple[DDSFormat, str]] = [
    ("BC1_UNORM_SRGB", "BC1 (4bpp, sRGB, 1-bit Alpha)"),
    ("BC1_UNORM", "BC1 (4bpp, Linear, 1-bit Alpha)"),
    ("BC3_UNORM_SRGB", "BC3 (8bpp, sRGB, 8-bit Alpha)"),
    ("BC3_UNORM", "BC3 (8bpp, Linear, 8-bit Alpha)"),
    ("BC4_UNORM", "BC4 (4bpp, Grayscale)"),
    ("BC5_UNORM", "BC5 (8bpp, Unsigned, 2-channel normal)"),
    ("BC5_SNORM", "BC5 (8bpp, Signed, 2-channel normal)"),
    ("BC7_UNORM_SRGB", "BC7 (8bpp, sRGB, 8-bit Alpha)"),
    ("BC7_UNORM", "BC7 (8bpp, Linear, 8-bit Alpha)"),
    ("DXT1", "DXT1 (4bpp, Linear, 1-bit Alpha)"),
    ("DXT3", "DXT3 (8bpp, Linear, 4-bit Alpha)"),
    ("DXT5", "DXT5 (8bpp, Linear, 8-bit Alpha)"),
    ("R8G8B8A8_UNORM_SRGB", "RGBA (32bpp, sRGB, 8-bit Alpha)"),
    ("R8G8B8A8_UNORM", "RGBA (32bpp, Linear, 8-bit Alpha)"),
    ("B8G8R8A8_UNORM_SRGB", "BGRA (32bpp, sRGB, 8-bit Alpha)"),
    ("B8G8R8A8_UNORM", "BGRA (32bpp, Linear, 8-bit Alpha)"),
    ("B5G5R5A1_UNORM", "BGRA (16bpp, Linear, 1-bit Alpha)"),
    ("B5G6R5_UNORM", "BGR (16bpp, Linear)"),
    ("B8G8R8X8_UNORM_SRGB", "BGRX (32bpp, sRGB)"),
    ("B8G8R8X8_UNORM", "BGRX (32bpp, Linear)"),
    ("R8G8_UNORM", "RG (16bpp, Linear)"),
    ("R8_UNORM", "R (8bpp, Linear)"),
]


def DdsFormatDropdown() -> DropDownInput:
    return DropDownInput(
        input_type="DdsFormat",
        label="DDS Format",
        options=[{"option": title, "value": f} for f, title in SUPPORTED_DDS_FORMATS],
        associated_type=DDSFormat,
        groups=[
            DropDownGroup("Compressed", start_at="BC1_UNORM_SRGB"),
            DropDownGroup("Uncompressed", start_at="R8G8B8A8_UNORM_SRGB"),
            DropDownGroup("Legacy Compressed", start_at="DXT1"),
        ],
    )


def DdsMipMapsDropdown() -> DropDownInput:
    return DropDownInput(
        input_type="DdsMipMaps",
        label="Generate Mip Maps",
        preferred_style="checkbox",
        options=[
            # these are not boolean values, see dds.py for more info
            {"option": "Yes", "value": 0},
            {"option": "No", "value": 1},
        ],
    )


class AudioStreamInput(BaseInput):
    def __init__(self, label: str = "Audio Stream"):
        super().__init__("AudioStream", label, kind="generic")
