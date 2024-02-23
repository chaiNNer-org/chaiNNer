from __future__ import annotations

from nodes.properties.inputs import TextInput
from nodes.properties.outputs import TextOutput

from .. import value_group


@value_group.register(
    schema_id="chainner:utility:text",
    name="文本",
    description="输出给定的文本。",
    icon="MdTextFields",
    inputs=[
        TextInput(
            "文本", min_length=0, label_style="hidden", allow_empty_string=True
        ).make_fused(),
    ],
    outputs=[
        TextOutput("文本", output_type="Input0"),
    ],
)
def text_node(text: str) -> str:
    return text
