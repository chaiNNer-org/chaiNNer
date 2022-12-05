from __future__ import annotations
from typing import List, Union, TypedDict
import numpy as np
from sanic.log import logger

from .. import expression

from .base_input import BaseInput
from ...utils.blend_modes import BlendModes as bm
from ...utils.image_utils import FillColor, FlipAxis, KernelType, normalize


class UntypedOption(TypedDict):
    option: str
    value: str | int


class TypedOption(TypedDict):
    option: str
    value: str | int
    type: expression.ExpressionJson


DropDownOption = Union[UntypedOption, TypedOption]


class DropDownInput(BaseInput):
    """Input for a dropdown"""

    def __init__(
        self,
        input_type: expression.ExpressionJson,
        label: str,
        options: List[DropDownOption],
        default_value: str | int | None = None,
    ):
        super().__init__(input_type, label, kind="dropdown", has_handle=False)
        self.options = options
        self.accepted_values = {o["value"] for o in self.options}
        self.default = (
            default_value if default_value is not None else options[0]["value"]
        )

        if not self.default in self.accepted_values:
            logger.error(
                f"Invalid default value {self.default} in {label} dropdown. Using first value instead."
            )
            self.default = options[0]["value"]

    def toDict(self):
        return {
            **super().toDict(),
            "options": self.options,
            "def": self.default,
        }

    def make_optional(self):
        raise ValueError("DropDownInput cannot be made optional")

    def enforce(self, value):
        assert value in self.accepted_values, f"{value} is not a valid option"
        return value


class TextInput(BaseInput):
    """Input for arbitrary text"""

    def __init__(
        self,
        label: str,
        has_handle=True,
        min_length: int = 1,
        max_length: Union[int, None] = None,
        placeholder: Union[str, None] = None,
        allow_numbers: bool = True,
        default: Union[str, None] = None,
    ):
        super().__init__(
            ["string", "number"] if allow_numbers else "string",
            label,
            has_handle=has_handle,
            kind="text-line",
        )
        self.min_length = min_length
        self.max_length = max_length
        self.placeholder = placeholder
        self.default = default

    def enforce(self, value) -> str:
        if isinstance(value, float) and int(value) == value:
            # stringify integers values
            return str(int(value))
        return str(value)

    def toDict(self):
        return {
            **super().toDict(),
            "minLength": self.min_length,
            "maxLength": self.max_length,
            "placeholder": self.placeholder,
            "def": self.default,
        }


class NoteTextAreaInput(BaseInput):
    """Input for note text"""

    def __init__(self, label: str = "Note Text"):
        super().__init__("string", label, has_handle=False, kind="text")
        self.resizable = True

    def toDict(self):
        return {
            **super().toDict(),
            "resizable": self.resizable,
        }


class ClipboardInput(BaseInput):
    """Input for pasting from clipboard"""

    def __init__(self, label: str = "Clipboard input"):
        super().__init__(["Image", "string", "number"], label, kind="text-line")
        self.input_conversion = """
            match Input {
                Image => "<Image>",
                _ as i => i,
            }
        """

    def enforce(self, value):
        if isinstance(value, np.ndarray):
            return normalize(value)

        if isinstance(value, float) and int(value) == value:
            # stringify integers values
            return str(int(value))

        return str(value)


class AnyInput(BaseInput):
    def __init__(self, label: str):
        super().__init__(input_type="any", label=label)

    def enforce_(self, value):
        # The behavior for optional inputs and None makes sense for all inputs except this one.
        return value


def MathOpsDropdown() -> DropDownInput:
    """Input for selecting math operation type from dropdown"""
    return DropDownInput(
        input_type="MathOperation",
        label="Math Operation",
        options=[
            {
                "option": "Add (+)",
                "value": "add",
                "type": """MathOperation { operation: "add" }""",
            },
            {
                "option": "Subtract (-)",
                "value": "sub",
                "type": """MathOperation { operation: "sub" }""",
            },
            {
                "option": "Multiply (×)",
                "value": "mul",
                "type": """MathOperation { operation: "mul" }""",
            },
            {
                "option": "Divide (÷)",
                "value": "div",
                "type": """MathOperation { operation: "div" }""",
            },
            {
                "option": "Exponent/Power (^)",
                "value": "pow",
                "type": """MathOperation { operation: "pow" }""",
            },
            {
                "option": "Maximum",
                "value": "max",
                "type": """MathOperation { operation: "max" }""",
            },
            {
                "option": "Minimum",
                "value": "min",
                "type": """MathOperation { operation: "min" }""",
            },
            {
                "option": "Modulo",
                "value": "mod",
                "type": """MathOperation { operation: "mod" }""",
            },
        ],
    )


def StackOrientationDropdown() -> DropDownInput:
    """Input for selecting stack orientation from dropdown"""
    return DropDownInput(
        input_type="Orientation",
        label="Orientation",
        options=[
            {
                "option": "Horizontal",
                "value": "horizontal",
                "type": "Orientation::Horizontal",
            },
            {
                "option": "Vertical",
                "value": "vertical",
                "type": "Orientation::Vertical",
            },
        ],
    )


def IteratorInput():
    """Input for showing that an iterator automatically handles the input"""
    return BaseInput("IteratorAuto", "Auto (Iterator)", has_handle=False)


class AlphaFillMethod:
    EXTEND_TEXTURE = 1
    EXTEND_COLOR = 2


def AlphaFillMethodInput() -> DropDownInput:
    """Alpha Fill method option dropdown"""
    return DropDownInput(
        input_type="FillMethod",
        label="Fill method",
        options=[
            {
                "option": "Extend texture",
                "value": AlphaFillMethod.EXTEND_TEXTURE,
            },
            {
                "option": "Extend color",
                "value": AlphaFillMethod.EXTEND_COLOR,
            },
        ],
    )


def VideoTypeDropdown() -> DropDownInput:
    """Video Type option dropdown"""
    return DropDownInput(
        input_type="VideoType",
        label="Video Type",
        options=[
            {"option": "MP4", "value": "mp4"},
            {"option": "MKV", "value": "mkv"},
            {"option": "WEBM", "value": "webm"},
            {"option": "AVI", "value": "avi"},
            {"option": "GIF", "value": "gif"},
            {"option": "None", "value": "none"},
        ],
    )


def VideoPresetDropdown() -> DropDownInput:
    """Video Type option dropdown"""
    return DropDownInput(
        input_type="VideoPreset",
        label="Preset",
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


def FlipAxisInput() -> DropDownInput:
    return DropDownInput(
        input_type="FlipAxis",
        label="Flip Axis",
        options=[
            {"option": "Horizontal", "value": FlipAxis.HORIZONTAL},
            {"option": "Vertical", "value": FlipAxis.VERTICAL},
            {"option": "Both", "value": FlipAxis.BOTH},
            {"option": "None", "value": FlipAxis.NONE},
        ],
    )


def TransferColorspaceInput() -> DropDownInput:
    return DropDownInput(
        input_type="TransferColorspace",
        label="Colorspace",
        options=[
            {"option": "L*a*b*", "value": "L*a*b*"},
            {"option": "RGB", "value": "RGB"},
        ],
    )


def OverflowMethodInput() -> DropDownInput:
    return DropDownInput(
        input_type="OverflowMethod",
        label="Overflow Method",
        options=[
            {"option": "Clip", "value": 1},
            {"option": "Scale", "value": 0},
        ],
    )


def ReciprocalScalingFactorInput() -> DropDownInput:
    return DropDownInput(
        input_type="ReciprocalScalingFactor",
        label="Reciprocal Scaling Factor",
        options=[
            {"option": "Yes", "value": 1},
            {"option": "No", "value": 0},
        ],
    )


def BlendModeDropdown() -> DropDownInput:
    """Blending Mode option dropdown"""
    return DropDownInput(
        input_type="BlendMode",
        label="Blend Mode",
        options=[
            {"option": "Normal", "value": bm.NORMAL},
            {"option": "Darken", "value": bm.DARKEN},
            {"option": "Multiply", "value": bm.MULTIPLY},
            {"option": "Color Burn", "value": bm.COLOR_BURN},
            {"option": "Linear Burn", "value": bm.LINEAR_BURN},
            {"option": "Lighten", "value": bm.LIGHTEN},
            {"option": "Screen", "value": bm.SCREEN},
            {"option": "Color Dodge", "value": bm.COLOR_DODGE},
            {"option": "Linear Dodge (Add)", "value": bm.ADD},
            {"option": "Overlay", "value": bm.OVERLAY},
            {"option": "Soft Light", "value": bm.SOFT_LIGHT},
            {"option": "Hard Light", "value": bm.HARD_LIGHT},
            {"option": "Vivid Light", "value": bm.VIVID_LIGHT},
            {"option": "Linear Light", "value": bm.LINEAR_LIGHT},
            {"option": "Pin Light", "value": bm.PIN_LIGHT},
            {"option": "Reflect", "value": bm.REFLECT},
            {"option": "Glow", "value": bm.GLOW},
            {"option": "Difference", "value": bm.DIFFERENCE},
            {"option": "Exclusion", "value": bm.EXCLUSION},
            {"option": "Negation", "value": bm.NEGATION},
            {"option": "Subtract", "value": bm.SUBTRACT},
            {"option": "Divide", "value": bm.DIVIDE},
            {"option": "Xor", "value": bm.XOR},
        ],
    )


def FillColorDropdown() -> DropDownInput:
    return DropDownInput(
        input_type="FillColor",
        label="Negative Space Fill",
        options=[
            {
                "option": "Auto",
                "value": FillColor.AUTO,
                "type": "FillColor::Auto",
            },
            {
                "option": "Black Fill",
                "value": FillColor.BLACK,
                "type": "FillColor::Black",
            },
            {
                "option": "Transparency",
                "value": FillColor.TRANSPARENT,
                "type": "FillColor::Transparent",
            },
        ],
    )


def TileSizeDropdown(label="Tile Size", estimate=True) -> DropDownInput:
    options = []
    if estimate:
        options.append({"option": "Auto (estimate)", "value": 0})

    options.append({"option": "Maximum", "value": -2})
    options.append({"option": "No Tiling", "value": -1})

    for size in [128, 192, 256, 384, 512, 768, 1024, 2048, 4096]:
        options.append({"option": str(size), "value": size})

    return DropDownInput(
        input_type="TileMode",
        label=label,
        options=options,
    )


def PaddingAlignmentDropdown(label="Alignment") -> DropDownInput:
    return DropDownInput(
        input_type="PaddingAlignment",
        label=label,
        options=[
            {
                "option": "Start",
                "value": "start",
                "type": "PaddingAlignment::Start",
            },
            {
                "option": "End",
                "value": "end",
                "type": "PaddingAlignment::End",
            },
            {
                "option": "Center",
                "value": "center",
                "type": "PaddingAlignment::Center",
            },
        ],
    )


def HbfTypeDropdown(label="Filter Type") -> DropDownInput:
    return DropDownInput(
        input_type="KernelType",
        label=label,
        options=[
            {"option": "Normal", "value": KernelType.NORMAL},
            {"option": "Strong", "value": KernelType.STRONG},
        ],
    )


def DdsFormatDropdown() -> DropDownInput:
    return DropDownInput(
        input_type="DdsFormat",
        label="DDS Format",
        options=[
            {
                "option": "BC1 (sRGB)",
                "value": "BC1_UNORM_SRGB",
            },
            {
                "option": "BC1 (Linear)",
                "value": "BC1_UNORM",
            },
            {
                "option": "BC3 (sRGB)",
                "value": "BC3_UNORM_SRGB",
            },
            {
                "option": "BC3 (Linear)",
                "value": "BC3_UNORM",
            },
            {
                "option": "BC4 (Linear, Unsigned)",
                "value": "BC4_UNORM",
            },
            {
                "option": "BC7 (sRGB)",
                "value": "BC7_UNORM_SRGB",
            },
            {
                "option": "BC7 (Linear)",
                "value": "BC7_UNORM",
            },
        ],
    )


def DdsMipMapsDropdown() -> DropDownInput:
    return DropDownInput(
        input_type="DdsMipMaps",
        label="Generate Mip Maps",
        options=[
            # these are not boolean values, see dds.py for more info
            {"option": "Yes", "value": 0},
            {"option": "No", "value": 1},
        ],
    )


def DdsErrorMetricDropdown() -> DropDownInput:
    return DropDownInput(
        input_type="DdsErrorMetric",
        label="Error Metric (BC1-BC3)",
        options=[
            {"option": "Perceptual", "value": 0},
            {"option": "Uniform", "value": 1},
        ],
    )


def DdsDitheringDropdown() -> DropDownInput:
    return DropDownInput(
        input_type="DdsDithering",
        label="Dithering (BC1-BC3)",
        options=[
            {"option": "Yes", "value": 1},
            {"option": "No", "value": 0},
        ],
    )


class BC7Compression:
    DEFAULT = 0
    BEST_SPEED = 1
    BEST_QUALITY = 2


def DdsBC7CompressionDropdown() -> DropDownInput:
    return DropDownInput(
        input_type="DdsBC7Compression",
        label="BC7 Compression",
        options=[
            {"option": "Default", "value": BC7Compression.DEFAULT},
            {"option": "Best Speed", "value": BC7Compression.BEST_SPEED},
            {"option": "Best Quality", "value": BC7Compression.BEST_QUALITY},
        ],
    )
