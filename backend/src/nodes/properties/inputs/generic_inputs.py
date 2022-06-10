from typing import Dict, List, Union
from .... import expression

from .base_input import BaseInput


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
        if value not in accepted_values and int(value) in accepted_values:
            value = int(value)
        assert value in accepted_values, f"{value} is not a valid option"
        return value


class TextInput(BaseInput):
    """Input for arbitrary text"""

    def __init__(
        self,
        label: str,
        has_handle=True,
        max_length: Union[int, None] = None,
    ):
        super().__init__("string", label, has_handle=has_handle, kind="text-line")
        self.max_length = max_length

    def toDict(self):
        return {
            **super().toDict(),
            "maxLength": self.max_length,
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
            },
            {
                "option": "Subtract (-)",
                "value": "sub",
            },
            {
                "option": "Multiply (×)",
                "value": "mul",
            },
            {
                "option": "Divide (÷)",
                "value": "div",
            },
            {
                "option": "Exponent/Power (^)",
                "value": "pow",
            },
            {
                "option": "Maximum",
                "value": "max",
            },
            {
                "option": "Minimum",
                "value": "min",
            },
        ],
    )


def StackOrientationDropdown() -> DropDownInput:
    """Input for selecting stack orientation from dropdown"""
    return DropDownInput(
        input_type="Orientation",
        label="Orientation",
        options=[
            {"option": "Horizontal", "value": "horizontal"},
            {"option": "Vertical", "value": "vertical"},
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
