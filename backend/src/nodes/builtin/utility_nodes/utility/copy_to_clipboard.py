from __future__ import annotations

from typing import Union

from nodes.utils import clipboard
import numpy as np

from ....api.node_base import NodeBase
from ....api.inputs import ClipboardInput


class Copy_To_Clipboard(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Copies the input to the clipboard."
        self.inputs = [
            ClipboardInput(),
        ]
        self.outputs = []

        self.name = "Copy To Clipboard"
        self.icon = "BsClipboard"

        self.side_effects = True

    def run(self, value: Union[str, np.ndarray]) -> None:
        if isinstance(value, np.ndarray):
            clipboard.copy_image(value)
        elif isinstance(value, str):
            clipboard.copy_text(value)
        else:
            raise RuntimeError(f"Unsupported type {type(value)}")
