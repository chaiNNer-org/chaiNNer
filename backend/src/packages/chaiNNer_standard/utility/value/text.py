from __future__ import annotations

from nodes.properties.inputs import TextInput
from nodes.properties.outputs import TextOutput

from .. import value_group


@value_group.register(
    schema_id="chainner:utility:text",
    name="Text",
    description="Outputs the given text.",
    icon="MdTextFields",
    inputs=[
        TextInput("Text", min_length=0, hide_label=True, allow_empty_string=True),
    ],
    outputs=[
        TextOutput("Text", output_type="Input0"),
    ],
)
def text_node(text: str) -> str:
    return text
