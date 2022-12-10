from __future__ import annotations

from . import category as UtilityCategory

from ...api.node_base import NodeBase
from ...api.node_factory import NodeFactory
from ...api.inputs import TextInput, NumberInput, PaddingAlignmentDropdown
from ...api.outputs import TextOutput


@NodeFactory.register("chainner:utility:text_padding")
class TextPaddingNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Pads text until it has a certain length."
        self.inputs = [
            TextInput("Text", min_length=0),
            NumberInput("Width", unit="chars"),
            TextInput(
                "Padding Character",
                has_handle=False,
                allow_numbers=False,
                min_length=1,
                max_length=1,
                placeholder="e.g. '0' or ' '",
            ),
            PaddingAlignmentDropdown(),
        ]
        self.outputs = [
            TextOutput(
                "Output Text",
                output_type="""
                let text = toString(Input0);
                match Input3 {
                    PaddingAlignment::Start => padStart(text, Input1, Input2),
                    PaddingAlignment::End => padEnd(text, Input1, Input2),
                    PaddingAlignment::Center => padCenter(text, Input1, Input2),
                }
                """,
            )
        ]

        self.category = UtilityCategory
        self.name = "Text Padding"
        self.icon = "MdTextFields"
        self.sub = "Text"

    def run(self, text: str, width: int, padding: str, alignment: str) -> str:
        if alignment == "start":
            return text.rjust(width, padding)
        elif alignment == "end":
            return text.ljust(width, padding)
        elif alignment == "center":
            return text.center(width, padding)
        else:
            raise ValueError(f"Invalid alignment '{alignment}'.")
