from __future__ import annotations

from typing import List, Union

from . import category as UtilityCategory

from ...node_base import NodeBase, group
from ...node_factory import NodeFactory
from ...properties.inputs import TextInput
from ...properties.outputs import TextOutput


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
                TextInput("Text C").make_optional(),
                TextInput("Text D").make_optional(),
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
                    match Input4 { null => "", _ as s => concat(sep, toString(s)) }
                )
                """,
            )
        ]

        self.category = UtilityCategory
        self.name = "Text Append"
        self.icon = "MdTextFields"
        self.sub = "Text"

    def run(
        self,
        separator: str,
        str1: str,
        str2: str,
        str3: Union[str, None],
        str4: Union[str, None],
    ) -> str:
        inputs: List[Union[str, None]] = [str1, str2, str3, str4]
        return separator.join([x for x in inputs if x is not None])
