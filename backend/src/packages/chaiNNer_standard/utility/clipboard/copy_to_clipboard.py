from __future__ import annotations

import numpy as np
from chainner_ext import Clipboard

from nodes.properties.inputs import ClipboardInput

from .. import clipboard_group


@clipboard_group.register(
    schema_id="chainner:utility:copy_to_clipboard",
    name="Copy To Clipboard",
    description="Copies the input to the clipboard.",
    icon="BsClipboard",
    inputs=[
        ClipboardInput(),
    ],
    outputs=[],
    side_effects=True,
)
def copy_to_clipboard_node(value: str | np.ndarray) -> None:
    if isinstance(value, np.ndarray):
        Clipboard.create_instance().write_image(value, "BGR")
    else:
        Clipboard.create_instance().write_text(value)
