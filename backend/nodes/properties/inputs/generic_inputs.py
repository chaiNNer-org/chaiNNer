from typing import List


def DropDownInput(input_type: str, label: str, options: List[str]) -> str:
    """ Input for a dropdown """
    return {
        "type": f"dropdown::{input_type}",
        "label": label,
        "options": options,
    }


def TextInput(label: str) -> str:
    """ Input for arbitrary text """
    return {
        "type": "text::any",
        "label": label,
    }
