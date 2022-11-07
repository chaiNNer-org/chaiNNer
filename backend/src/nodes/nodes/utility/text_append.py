from __future__ import annotations

from typing import List, Union

from . import category as UtilityCategory

from ...node_base import NodeBase, group
from ...node_factory import NodeFactory
from ...properties.inputs import TextInput
from ...properties.outputs import TextOutput
from ...utils.utils import ALPHABET


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
                    for letter in ALPHABET[2:]
                ],
            ),
        ]
        self.outputs = [
            TextOutput(
                "Output Text",
                output_type="""
                let sep = toString(Input0);
                concat(
                    toString(Input1),
                    sep,
                    toString(Input2),
                    match Input3 { null => "", _ as s => concat(sep, toString(s)) },
                    match Input4 { null => "", _ as s => concat(sep, toString(s)) },
                    match Input5 { null => "", _ as s => concat(sep, toString(s)) },
                    match Input6 { null => "", _ as s => concat(sep, toString(s)) },
                    match Input7 { null => "", _ as s => concat(sep, toString(s)) },
                    match Input8 { null => "", _ as s => concat(sep, toString(s)) },
                    match Input9 { null => "", _ as s => concat(sep, toString(s)) },
                    match Input10 { null => "", _ as s => concat(sep, toString(s)) },
                    match Input11 { null => "", _ as s => concat(sep, toString(s)) },
                    match Input12 { null => "", _ as s => concat(sep, toString(s)) },
                    match Input13 { null => "", _ as s => concat(sep, toString(s)) },
                    match Input14 { null => "", _ as s => concat(sep, toString(s)) },
                    match Input15 { null => "", _ as s => concat(sep, toString(s)) },
                    match Input16 { null => "", _ as s => concat(sep, toString(s)) },
                    match Input17 { null => "", _ as s => concat(sep, toString(s)) },
                    match Input18 { null => "", _ as s => concat(sep, toString(s)) },
                    match Input19 { null => "", _ as s => concat(sep, toString(s)) },
                    match Input20 { null => "", _ as s => concat(sep, toString(s)) },
                    match Input21 { null => "", _ as s => concat(sep, toString(s)) },
                    match Input22 { null => "", _ as s => concat(sep, toString(s)) },
                    match Input23 { null => "", _ as s => concat(sep, toString(s)) },
                    match Input24 { null => "", _ as s => concat(sep, toString(s)) },
                    match Input25 { null => "", _ as s => concat(sep, toString(s)) },
                    match Input26 { null => "", _ as s => concat(sep, toString(s)) },
                )
                """,
            )
        ]

        self.category = UtilityCategory
        self.name = "Text Append"
        self.icon = "MdTextFields"
        self.sub = "Text"

    def run(self, separator: str, str1: str, str2: str, *args: Union[str, None]) -> str:
        inputs: List[Union[str, None]] = [str1, str2, *args]
        return separator.join([x for x in inputs if x is not None])
