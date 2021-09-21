from typing import List


def DropDownInput(type: str, label: str, options: List[str]) -> str:
    """ Input for submitting a local file """
    return {
        "type": f"dropdown::{type}",
        "label": label,
        "options": options,
    }
