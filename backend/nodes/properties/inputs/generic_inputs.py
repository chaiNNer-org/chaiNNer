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
    }


def NumberInput(label: str) -> Dict:
    """ Input for arbitrary number """
    return {
        "type": "number::any",
        "label": label,
    }


def IntegerInput(label: str) -> Dict:
    """ Input for integer number """
    return {
        "type": "number::integer",
        "label": label,
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
