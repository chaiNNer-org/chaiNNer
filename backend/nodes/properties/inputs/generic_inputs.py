from typing import Dict, List

from .base_input import BaseInput


class DropDownInput(BaseInput):
    """Input for a dropdown"""

    def __init__(
        self,
        label: str,
        options: List[Dict],
        input_type: str = "generic",
        optional: bool = False,
    ):
        super().__init__(f"dropdown::{input_type}", label, optional, has_handle=False)
        self.options = options

    def toDict(self):
        return {
            **super().toDict(),
            "options": self.options,
        }

    def enforce(self, value):
        accepted_values = [o["value"] for o in self.options]
        if value not in accepted_values and int(value) in accepted_values:
            value = int(value)
        assert value in accepted_values, f"{value} is not a valid option"
        return value


class TextInput(BaseInput):
    """Input for arbitrary text"""

    def __init__(self, label: str, has_handle=True, max_length=None, optional=False):
        super().__init__(f"text::any", label, optional, has_handle=has_handle)
        self.max_length = max_length

    def toDict(self):
        return {
            **super().toDict(),
            "maxLength": self.max_length,
        }


class NoteTextAreaInput(BaseInput):
    """Input for note text"""

    def __init__(self, label: str = "Note Text"):
        super().__init__(f"textarea::note", label, optional=True, has_handle=False)
        self.resizable = True

    def toDict(self):
        return {
            **super().toDict(),
            "resizable": self.resizable,
        }


def MathOpsDropdown() -> DropDownInput:
    """Input for selecting math operation type from dropdown"""
    return DropDownInput(
        "Math Operation",
        [
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
        input_type="math-operations",
    )


def StackOrientationDropdown() -> DropDownInput:
    """Input for selecting stack orientation from dropdown"""
    return DropDownInput(
        "Orientation",
        [
            {
                "option": "Horizontal",
                "value": "horizontal",
            },
            {
                "option": "Vertical",
                "value": "vertical",
            },
        ],
        optional=True,
    )


def IteratorInput():
    """Input for showing that an iterator automatically handles the input"""
    return BaseInput(
        "iterator::auto", "Auto (Iterator)", optional=True, has_handle=False
    )


class AlphaFillMethod:
    EXTEND_TEXTURE = 1
    EXTEND_COLOR = 2


def AlphaFillMethodInput() -> DropDownInput:
    """Alpha Fill method option dropdown"""
    return DropDownInput(
        "Fill method",
        [
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
        "Video Type",
        [
            {
                "option": "MP4",
                "value": "mp4",
            },
            {
                "option": "AVI",
                "value": "avi",
            },
            {
                "option": "None",
                "value": "none",
            },
        ],
    )
