from typing import List, Dict


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


def NumberInput(label: str, default=0.0, minimum=0, step=1) -> Dict:
    """Input for arbitrary number"""
    return {
        "type": "number::any",
        "label": label,
        "min": minimum,
        "def": default,
        "step": step,
        "hasHandle": True,
    }


def BoundedNumberInput(
    label: str,
    minimum: float = 0.0,
    maximum: float = 1.0,
    default: float = 0.5,
    step: float = 0.25,
) -> Dict:
    """Input for bounded number range"""
    return {
        "type": "number::any",
        "label": label,
        "min": minimum,
        "max": maximum,
        "def": default,
        "step": step,
        "hasHandle": True,
    }


def IntegerInput(label: str) -> Dict:
    """Input for integer number"""
    return {
        "type": "number::integer",
        "label": label,
        "min": 0,
        "def": 0,
        "hasHandle": True,
    }


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
