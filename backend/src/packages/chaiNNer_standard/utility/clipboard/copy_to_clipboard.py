from __future__ import annotations

from typing import Union

import numpy as np

from nodes.impl import clipboard
from nodes.properties.inputs import ClipboardInput

from .. import clipboard_group


@clipboard_group.register(
    schema_id="chainner:utility:copy_to_clipboard",
    name="Copy To Clipboard",
    description=[
        "Copies the input to the clipboard.",
        "Currently does not work on Arm MacOS.",
    ],
    icon="BsClipboard",
    inputs=[
        ClipboardInput(),
    ],
    outputs=[],
    side_effects=True,
)
def copy_to_clipboard_node(value: Union[str, np.ndarray]) -> None:
    if isinstance(value, np.ndarray):
        clipboard.copy_image(value)
    elif isinstance(value, str):  # type: ignore
        clipboard.copy_text(value)
    else:
        raise RuntimeError(f"Unsupported type {type(value)}")
