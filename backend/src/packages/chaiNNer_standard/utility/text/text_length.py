from __future__ import annotations

from nodes.properties.inputs import TextInput
from nodes.properties.outputs import NumberOutput

from .. import text_group


@text_group.register(
    schema_id="chainner:utility:text_length",
    name="Text Length",
    description="Returns the number characters in a string of text.",
    icon="MdTextFields",
    inputs=[
        TextInput("Text", min_length=0),
    ],
    outputs=[
        NumberOutput("Length", output_type="string::len(Input0)"),
    ],
)
def text_length_node(text: str) -> int:
    return len(text)
