from typing import List


def DropDownInput(input_type: str, label: str, options: List[str]) -> str:
    """ Input for submitting a local file """
    return {
        "type": f"dropdown::{input_type}",
        "label": label,
        "options": options,
    }
