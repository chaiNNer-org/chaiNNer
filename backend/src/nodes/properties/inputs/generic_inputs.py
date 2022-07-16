from typing import Dict, List, Union

from .. import expression

from .base_input import BaseInput
from ...utils.blend_modes import BlendModes as bm
from ...utils.image_utils import FillColor


class DropDownInput(BaseInput):
    """Input for a dropdown"""

    def __init__(
        self,
        input_type: expression.ExpressionJson,
        label: str,
        options: List[Dict],
    ):
        super().__init__(input_type, label, kind="dropdown", has_handle=False)
        self.options = options

    def toDict(self):
        return {
            **super().toDict(),
            "options": self.options,
        }

    def make_optional(self):
        raise ValueError("DropDownInput cannot be made optional")

    def enforce(self, value):
        accepted_values = [o["value"] for o in self.options]
        assert value in accepted_values, f"{value} is not a valid option"
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
        allow_numbers: bool = False,
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
                "type": "Horizontal",
            },
            {
                "option": "Vertical",
                "value": "vertical",
                "type": "Vertical",
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
            {"option": "AVI", "value": "avi"},
            {"option": "None", "value": "none"},
        ],
    )


def FlipAxisInput() -> DropDownInput:
    return DropDownInput(
        input_type="FlipAxis",
        label="Flip Axis",
        options=[
            {"option": "Horizontal", "value": 1},
            {"option": "Vertical", "value": 0},
            {"option": "Both", "value": -1},
        ],
    )


def ColorspaceInput() -> DropDownInput:
    return DropDownInput(
        input_type="Colorspace",
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
            {"option": "Lighten", "value": bm.LIGHTEN},
            {"option": "Screen", "value": bm.SCREEN},
            {"option": "Color Dodge", "value": bm.COLOR_DODGE},
            {"option": "Add", "value": bm.ADD},
            {"option": "Overlay", "value": bm.OVERLAY},
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
            {"option": "Auto", "value": FillColor.AUTO},
            {"option": "Black Fill", "value": FillColor.BLACK},
            {"option": "Transparency", "value": FillColor.TRANSPARENT},
        ],
    )
