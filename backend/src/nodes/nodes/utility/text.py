from __future__ import annotations

from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import TextInput
from ...properties.outputs import TextOutput
from . import category as UtilityCategory


@NodeFactory.register("chainner:utility:text")
class TextValueNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Outputs the given text."
        self.inputs = [
            TextInput("Text", min_length=0),
        ]
        self.outputs = [
            TextOutput("Text", output_type="Input0"),
        ]

        self.category = UtilityCategory
        self.name = "Text"
        self.icon = "MdTextFields"
        self.sub = "Value"

    def run(self, text: str) -> str:
        return text
