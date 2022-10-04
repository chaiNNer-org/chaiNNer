from __future__ import annotations

from typing import Union

from nodes.utils import clipboard

from . import category as UtilityCategory

from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import *
from ...properties.outputs import *


@NodeFactory.register("chainner:utility:copy_to_clipboard")
class TextClipboardNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Copies the input to the clipboard."
        self.inputs = [
            ClipboardInput(),
        ]
        self.outputs = []

        self.category = UtilityCategory
        self.name = "Copy To Clipboard"
        self.icon = "BsClipboard"
        self.sub = "Clipboard"

        self.side_effects = True

    def run(self, value: Union[str, np.ndarray]) -> None:
        if isinstance(value, np.ndarray):
            clipboard.copy_image(value)
        elif isinstance(value, str):
            clipboard.copy_text(value)
        else:
            raise RuntimeError(f"Unsupported type {type(value)}")
