from __future__ import annotations

import json
import re
from dataclasses import dataclass
from enum import Enum
from typing import Any, Literal, TypedDict, TypeVar

import numpy as np
from typing_extensions import NotRequired

import navi
from api import BaseInput, InputConversion, group
from logger import logger

from ...condition import Condition, ConditionJson
from ...impl.blend import BlendMode
from ...impl.color.color import Color
from ...impl.image_utils import FillColor
from ...impl.upscale.auto_split_tiles import (
    CUSTOM,
    ESTIMATE,
    MAX_TILE_SIZE,
    NO_TILING,
    TileSize,
)
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
    icon: NotRequired[str | None]
    value: str | int
    type: NotRequired[navi.ExpressionJson]
    condition: NotRequired[ConditionJson | None]


DropDownStyle = Literal["dropdown", "checkbox", "tabs", "icons", "anchor"]
"""
This specified the preferred style in which the frontend may display the dropdown.

- `dropdown`: This is the default style. The dropdown will simply be displayed as a dropdown.
- `checkbox`: If the dropdown has 2 options, then it will be displayed as a checkbox.
  The first option will be interpreted as the yes/true option while the second option will be interpreted as the no/false option.
- `tabs`: The options are displayed as tab list. The label of the input itself will *not* be displayed.
- `icons`: The options are displayed as a list of icons. This is only available if all options have icons. Labels are still required for all options.
- `anchor`: The options are displayed as a 3x3 grid where the user is allowed to select one of 9 anchor positions. This only works for dropdowns with 9 options.
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


T = TypeVar("T")


class DropDownInput(BaseInput[T]):
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
                "Invalid default value %s in %s dropdown. Using first value instead.",
                self.default,
                label,
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

    def enforce(self, value: object) -> T:
        assert value in self.accepted_values, f"{value} is not a valid option"
        return value  # type: ignore

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


class _BoolEnumInput(DropDownInput[bool]):
    def __init__(self, label: str, *, default: bool = True, icon: str | None = None):
        super().__init__(
            input_type="bool",
            label=label,
            default_value=int(default),
            options=[
                {
                    "option": "Yes",
                    "value": int(True),  # 1
                    "type": "true",
                    "icon": icon,
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


class _BoolGenericInput(BaseInput[bool]):
    def __init__(self, label: str):
        super().__init__(input_type="bool", label=label)
        self.associated_type = bool

    def enforce(self, value: object) -> bool:
        if isinstance(value, bool):
            return value
        if isinstance(value, int):
            return bool(value)

        raise ValueError(
            f"The value of input '{self.label}' should have been either True or False."
        )


def BoolInput(
    label: str,
    *,
    default: bool = True,
    icon: str | None = None,
    has_handle: bool = False,
):
    if has_handle:
        return _BoolGenericInput(label)
    return _BoolEnumInput(label, default=default, icon=icon)


E = TypeVar("E", bound=Enum)


class EnumInput(DropDownInput[E]):
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
        enum: type[E],
        label: str | None = None,
        *,
        default: E | None = None,
        type_name: str | None = None,
        option_labels: dict[E, str] | None = None,
        extra_definitions: str | None = None,
        preferred_style: DropDownStyle = "dropdown",
        label_style: LabelStyle = "default",
        categories: list[DropDownGroup] | None = None,
        conditions: dict[E, Condition] | None = None,
        icons: dict[E, str] | None = None,
    ):
        if type_name is None:
            type_name = enum.__name__
        if label is None:
            label = join_space_case(split_pascal_case(type_name))
        if option_labels is None:
            option_labels = {}
        if conditions is None:
            conditions = {}
        if icons is None:
            icons = {}

        options: list[DropDownOption] = []
        variant_types: list[str] = []
        for variant in enum:
            value = variant.value
            assert isinstance(value, (int, str))

            variant_type = EnumInput.get_variant_type(variant, type_name)
            option_label = option_labels.get(
                variant, join_space_case(split_snake_case(variant.name))
            )
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
                    "icon": icons.get(variant),
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

    @staticmethod
    def get_variant_type(variant: Enum, type_name: str | None = None) -> str:
        """
        Returns the full type name of a variant of an enum.
        """

        enum = variant.__class__
        if type_name is None:
            type_name = enum.__name__

        assert (
            re.match(r"^[a-zA-Z_][a-zA-Z0-9_]*$", variant.name) is not None
        ), f"Expected the name of {enum.__name__}.{variant.name} to be snake case."

        return f"{type_name}::{join_pascal_case(split_snake_case(variant.name))}"

    def enforce(self, value: object) -> E:
        value = super().enforce(value)
        return self.enum(value)


class TextInput(BaseInput[str]):
    """Input for arbitrary text"""

    def __init__(
        self,
        label: str,
        *,
        has_handle: bool = True,
        min_length: int = 0,
        max_length: int | None = None,
        placeholder: str | None = None,
        multiline: bool = False,
        allow_numbers: bool = True,
        default: str | None = None,
        label_style: LabelStyle = "default",
        allow_empty_string: bool = False,
        invalid_pattern: str | None = None,
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
        self.invalid_pattern = invalid_pattern

        if default is not None:
            assert default != "" or allow_empty_string
            assert min_length <= len(default)
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
            "invalidPattern": self.invalid_pattern,
        }


class ClipboardInput(BaseInput):
    """Input for pasting from clipboard"""

    def __init__(self, label: str = "Clipboard input"):
        super().__init__(["Image", "string", "number"], label, kind="text")
        self.input_conversions = [InputConversion("Image", '"<Image>"')]

        self.label_style: LabelStyle = "hidden"

    def enforce(self, value: object):
        if isinstance(value, np.ndarray):
            return value

        if isinstance(value, float) and int(value) == value:
            # stringify integers values
            return str(int(value))

        return str(value)

    def to_dict(self):
        return {
            **super().to_dict(),
            "labelStyle": self.label_style,
        }


class AnyInput(BaseInput[object]):
    def __init__(self, label: str):
        super().__init__(input_type="any", label=label)
        self.associated_type = object

    def enforce_(self, value: object):
        # The behavior for optional inputs and None makes sense for all inputs except this one.
        return value


class SeedInput(NumberInput):
    def __init__(self, label: str = "Seed", *, has_handle: bool = True):
        super().__init__(
            label=label,
            min=None,
            max=None,
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

    def enforce(self, value: object) -> Seed:  # type: ignore
        if isinstance(value, Seed):
            return value
        if isinstance(value, (int, float, str)):
            return Seed(int(value))
        raise ValueError(f"Cannot convert {value} to Seed")

    def make_optional(self):
        raise ValueError("SeedInput cannot be made optional")


class ColorInput(BaseInput[Color]):
    def __init__(
        self,
        label: str = "Color",
        *,
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
    label: str = "Tile Size", *, estimate: bool = True, default: TileSize | None = None
) -> DropDownInput:
    options = []
    if estimate:
        options.append({"option": "Auto (estimate)", "value": ESTIMATE})

    options.append({"option": "Maximum", "value": MAX_TILE_SIZE})
    options.append({"option": "No Tiling", "value": NO_TILING})

    for size in [128, 192, 256, 384, 512, 768, 1024, 1536, 2048, 3072, 4096]:
        options.append({"option": str(size), "value": size})

    options.append({"option": "Custom", "value": CUSTOM})

    return DropDownInput(
        input_type="TileSize",
        label=label,
        options=options,
        associated_type=TileSize,
        default_value=default,
    )


class AudioStreamInput(BaseInput):
    def __init__(self, label: str = "Audio Stream"):
        super().__init__("AudioStream", label, kind="generic")


class OrderEnum(Enum):
    ROW_MAJOR = 0
    COLUMN_MAJOR = 1


def RowOrderDropdown() -> DropDownInput:
    return EnumInput(
        OrderEnum,
        label="Order",
        default=OrderEnum.ROW_MAJOR,
    )


class Anchor(Enum):
    TOP_LEFT = "top_left"
    TOP = "top_centered"
    TOP_RIGHT = "top_right"
    LEFT = "centered_left"
    CENTER = "centered"
    RIGHT = "centered_right"
    BOTTOM_LEFT = "bottom_left"
    BOTTOM = "bottom_centered"
    BOTTOM_RIGHT = "bottom_right"


def AnchorInput(label: str = "Anchor", icon: str = "BsFillImageFill") -> DropDownInput:
    return EnumInput(
        Anchor,
        label=label,
        label_style="inline",
        option_labels={
            Anchor.TOP_LEFT: "Top Left",
            Anchor.TOP: "Top",
            Anchor.TOP_RIGHT: "Top Right",
            Anchor.LEFT: "Left",
            Anchor.CENTER: "Center",
            Anchor.RIGHT: "Right",
            Anchor.BOTTOM_LEFT: "Bottom Left",
            Anchor.BOTTOM: "Bottom",
            Anchor.BOTTOM_RIGHT: "Bottom Right",
        },
        icons={
            Anchor.TOP_LEFT: icon,
            Anchor.TOP: icon,
            Anchor.TOP_RIGHT: icon,
            Anchor.LEFT: icon,
            Anchor.CENTER: icon,
            Anchor.RIGHT: icon,
            Anchor.BOTTOM_LEFT: icon,
            Anchor.BOTTOM: icon,
            Anchor.BOTTOM_RIGHT: icon,
        },
        preferred_style="anchor",
        default=Anchor.CENTER,
    )


class DictInput(BaseInput):
    """Input for a dictionary with string keys and string/number values"""

    def __init__(
        self,
        label: str = "Dictionary",
        dict_type: navi.ExpressionJson = "Dict",
    ):
        super().__init__(
            navi.intersect_with_error("Dict", dict_type),
            label,
            kind="generic",
        )

    def enforce(self, value: object) -> dict[str, str | int | float]:
        assert isinstance(value, dict)
        result: dict[str, str | int | float] = {}
        for k, v in value.items():
            assert isinstance(k, str), f"Dict keys must be strings, got {type(k)}"
            assert isinstance(
                v, (str, int, float)
            ), f"Dict values must be strings or numbers, got {type(v)}"
            result[k] = v
        return result
