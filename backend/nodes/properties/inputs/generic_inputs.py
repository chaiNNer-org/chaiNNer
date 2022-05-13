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
        super().__init__(f"dropdown::{input_type}", label, optional)
        self.options = options

    def toDict(self):
        return {
            "type": self.input_type,
            "label": self.label,
            "options": self.options,
            "optional": self.optional,
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
            "type": self.input_type,
            "label": self.label,
            "hasHandle": self.has_handle,
            "maxLength": self.max_length,
            "optional": self.optional,
        }


def NoteTextAreaInput() -> Dict:
    """Input for note text"""
    return {
        "type": "textarea::note",
        "label": "Note Text",
        "resizable": True,
        "hasHandle": False,
        "optional": True,
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


def IteratorInput() -> Dict:
    """Input for showing that an iterator automatically handles the input"""
    return {
        "type": "iterator::auto",
        "label": "Auto (Iterator)",
        "hasHandle": False,
        "optional": True,
    }


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
