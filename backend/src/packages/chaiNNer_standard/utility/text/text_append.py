from __future__ import annotations

from typing import List, Union

from nodes.groups import optional_list_group
from nodes.properties.inputs import TextInput
from nodes.properties.outputs import TextOutput
from nodes.utils.utils import ALPHABET

from .. import text_group


@text_group.register(
    schema_id="chainner:utility:text_append",
    name="Text Append",
    description="Append different text together using a separator string.",
    icon="MdTextFields",
    inputs=[
        TextInput(
            "Separator",
            has_handle=False,
            min_length=0,
            max_length=3,
            default="-",
            allow_empty_string=True,
        ),
        TextInput("Text A"),
        TextInput("Text B"),
        optional_list_group(
            *[TextInput(f"Text {letter}").make_optional() for letter in ALPHABET[2:10]],
        ),
    ],
    outputs=[
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
    ],
)
def text_append_node(separator: str, *args: Union[str, None]) -> str:
    inputs: List[Union[str, None]] = [*args]
    return separator.join([x for x in inputs if x is not None])
