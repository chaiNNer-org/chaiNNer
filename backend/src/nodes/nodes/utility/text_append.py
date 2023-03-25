from __future__ import annotations

from typing import List, Union

from ...group import group
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import TextInput
from ...properties.outputs import TextOutput
from ...utils.utils import ALPHABET
from . import category as UtilityCategory


@NodeFactory.register("chainner:utility:text_append")
class TextAppendNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Append different text together using a separator string."
        self.inputs = [
            TextInput(
                "Separator",
                has_handle=False,
                min_length=0,
                max_length=3,
                default="-",
            ),
            TextInput("Text A"),
            TextInput("Text B"),
            group("optional-list")(
                *[
                    TextInput(f"Text {letter}").make_optional()
                    for letter in ALPHABET[2:10]
                ],
            ),
        ]
        self.outputs = [
            TextOutput(
                "Output Text",
                output_type="""
                let sep = Input0;
                string::concat(
                    Input1,
                    sep,
                    Input2,
                    match Input3 { null => "", _ as s => string::concat(sep, s) },
                    match Input4 { null => "", _ as s => string::concat(sep, s) },
                    match Input5 { null => "", _ as s => string::concat(sep, s) },
                    match Input6 { null => "", _ as s => string::concat(sep, s) },
                    match Input7 { null => "", _ as s => string::concat(sep, s) },
                    match Input8 { null => "", _ as s => string::concat(sep, s) },
                    match Input9 { null => "", _ as s => string::concat(sep, s) },
                    match Input10 { null => "", _ as s => string::concat(sep, s) }
                )
                """,
            )
        ]

        self.category = UtilityCategory
        self.name = "Text Append"
        self.icon = "MdTextFields"
        self.sub = "Text"

    def run(self, separator: str, *args: Union[str, None]) -> str:
        inputs: List[Union[str, None]] = [*args]
        return separator.join([x for x in inputs if x is not None])
