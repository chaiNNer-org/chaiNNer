from typing import Dict, List


def DropDownInput(input_type: str, label: str, options: List[str]) -> Dict:
    """ Input for a dropdown """
    return {
        "type": f"dropdown::{input_type}",
        "label": label,
        "options": options,
    }


def TextInput(label: str) -> Dict:
    """ Input for arbitrary text """
    return {
        "type": "text::any",
        "label": label,
        "hasHandle": True,
    }


def NumberInput(label: str, default=0.0, minimum=0, step=1) -> Dict:
    """ Input for arbitrary number """
    return {
        "type": "number::any",
        "label": label,
        "min": minimum,
        "def": default,
        "step": step,
        "hasHandle": True,
    }


def IntegerInput(label: str) -> Dict:
    """ Input for integer number """
    return {
        "type": "number::integer",
        "label": label,
        "min": 0,
        "def": 0,
        "hasHandle": True,
    }


def OddIntegerInput(label: str) -> Dict:
    """ Input for integer number """
    return {
        "type": "number::integer::odd",
        "label": label,
        "def": 1,
        "step": 2,
        "min": 1,
        "hasHandle": True,
    }


def BoundlessIntegerInput(label: str) -> Dict:
    """ Input for integer number """
    return {
        "type": "number::integer",
        "label": label,
        "min": None,
        "max": None,
        "def": 0,
        "hasHandle": True,
    }


def SliderInput(label: str, min: int, max: int, default: int) -> Dict:
    """ Input for integer number via slider"""
    return {
        "type": "number::slider",
        "label": label,
        "min": min,
        "max": max,
        "def": default,
    }


def NoteTextAreaInput() -> Dict:
    """ Input for note text """
    return {
        "type": "textarea::note",
        "label": "Note Text",
        "resizable": True,
        "hasHandle": False,
        "optional": True,
    }


def MathOpsDropdown() -> Dict:
    """ Input for selecting math operation type from dropdown """
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
