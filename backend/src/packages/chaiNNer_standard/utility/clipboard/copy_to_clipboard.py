from __future__ import annotations

import numpy as np
from chainner_ext import Clipboard

from nodes.properties.inputs import ClipboardInput

from .. import clipboard_group


@clipboard_group.register(
    schema_id="chainner:utility:copy_to_clipboard",
    name="复制到剪贴板",
    description="将输入复制到剪贴板。",
    icon="BsClipboard",
    inputs=[
        ClipboardInput(),
    ],
    outputs=[],
    side_effects=True,
    limited_to_8bpc="图像将以每通道8位的精度复制到剪贴板。",
)
def copy_to_clipboard_node(value: str | np.ndarray) -> None:
    if isinstance(value, np.ndarray):
        Clipboard.create_instance().write_image(value, "BGR")
    else:
        Clipboard.create_instance().write_text(value)
