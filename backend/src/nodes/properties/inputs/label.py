from typing import Literal

LabelStyle = Literal["default", "hidden", "inline"]


def get_default_label_style(label: str) -> LabelStyle:
    return "inline" if len(label) <= 8 else "default"
