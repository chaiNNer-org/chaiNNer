from __future__ import annotations

from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import TextInput
from ...properties.outputs import NumberOutput
from . import category as UtilityCategory


@NodeFactory.register("chainner:utility:text_length")
class TextLengthNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Returns the number characters in a string of text."
        self.inputs = [
            TextInput("Text", min_length=0),
        ]
        self.outputs = [
            NumberOutput("Length", output_type="string::len(Input0)"),
        ]

        self.category = UtilityCategory
        self.name = "Text Length"
        self.icon = "MdTextFields"
        self.sub = "Text"

    def run(self, text: str) -> int:
        return len(text)
