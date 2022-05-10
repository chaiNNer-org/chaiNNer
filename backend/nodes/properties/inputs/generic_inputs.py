from typing import Dict, List

from .base_input import BaseInput


def DropDownInput(
    input_type: str, label: str, options: List[Dict], optional: bool = False
) -> Dict:
    """Input for a dropdown"""
    return {
        "type": f"dropdown::{input_type}",
        "label": label,
        "options": options,
        "optional": optional,
    }


def TextInput(label: str, has_handle=True, max_length=None, optional=False) -> Dict:
    """Input for arbitrary text"""
    return {
        "type": "text::any",
        "label": label,
        "hasHandle": has_handle,
        "maxLength": max_length,
        "optional": optional,
    }


class NumberInput(BaseInput):
    def __init__(self, label: str, default=0.0, minimum=0, maximum=None, step=1):
        """Input a number"""
        super().__init__("number::any", label)
        self.default = default
        self.minimum = minimum
        self.maximum = maximum
        self.step = step

    def toDict(self):
        return {
            "type": self.input_type,
            "label": self.label,
            "min": self.minimum,
            "max": self.maximum,
            "def": self.default,
            "step": self.step,
            "hasHandle": True,
        }

    def enforce(self, value):
        assert value is not None, "Number does not exist"
        return min(float(self.minimum), float(value))


class IntegerInput(NumberInput):
    def __init__(self, label: str):
        """Input an integer number"""
        super().__init__(label, default=0, minimum=0, maximum=None, step=None)

    def enforce(self, value):
        assert value is not None, "Number does not exist"
        return min(int(self.minimum), int(value))


class BoundedNumberInput(NumberInput):
    def __init__(
        self,
        label: str,
        minimum: float = 0.0,
        maximum: float = 1.0,
        default: float = 0.5,
        step: float = 0.25,
    ):
        """Input for a bounded integer number range"""
        super().__init__(
            label, default=default, minimum=minimum, maximum=maximum, step=step
        )

    def enforce(self, value):
        assert value is not None, "Number does not exist"
        return max(min(int(self.minimum), int(value)), int(self.maximum))


def OddIntegerInput(label: str, default: int = 1, minimum: int = 1) -> Dict:
    """Input for integer number"""
    return {
        "type": "number::integer::odd",
        "label": label,
        "def": default,
        "step": 2,
        "min": minimum,
        "hasHandle": True,
    }


def BoundedIntegerInput(
    label: str,
    minimum: int = 0,
    maximum: int = 100,
    default: int = 50,
    optional: bool = False,
) -> Dict:
    """Bounded input for integer number"""
    return {
        "type": "number::integer",
        "label": label,
        "min": minimum,
        "max": maximum,
        "def": default,
        "hasHandle": True,
        "optional": optional,
    }


def BoundlessIntegerInput(label: str) -> Dict:
    """Input for integer number"""
    return {
        "type": "number::integer",
        "label": label,
        "min": None,
        "max": None,
        "def": 0,
        "hasHandle": True,
    }


def SliderInput(
    label: str, min_val: int, max_val: int, default: int, optional: bool = False
) -> Dict:
    """Input for integer number via slider"""
    return {
        "type": "number::slider",
        "label": label,
        "min": min_val,
        "max": max_val,
        "def": default,
        "optional": optional,
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


def MathOpsDropdown() -> Dict:
    """Input for selecting math operation type from dropdown"""
    return DropDownInput(
        "math-operations",
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
    )


def StackOrientationDropdown() -> Dict:
    """Input for selecting stack orientation from dropdown"""
    return DropDownInput(
        "generic",
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


def AlphaFillMethodInput() -> Dict:
    """Alpha Fill method option dropdown"""
    return DropDownInput(
        "generic",
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


def VideoTypeDropdown() -> Dict:
    """Video Type option dropdown"""
    return DropDownInput(
        "generic",
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
