from __future__ import annotations

from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import NumberInput, TextInput
from ...properties.outputs import NumberOutput
from . import category as UtilityCategory


@NodeFactory.register("chainner:utility:parse_number")
class ParseNumberNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Parses text to base-10."
        self.inputs = [
            TextInput("Text", min_length=0),
            NumberInput("Base", default=10, minimum=2, maximum=36),
        ]
        self.outputs = [
            NumberOutput(
                "Value",
                output_type="int & number::parseInt(Input0, Input1)",
            ).with_never_reason("The given text cannot be parsed into a number."),
        ]

        self.category = UtilityCategory
        self.name = "Parse Number"
        self.icon = "MdCalculate"
        self.sub = "Value"

    def run(self, text: str, base: int) -> int:
        return int(text, base)
