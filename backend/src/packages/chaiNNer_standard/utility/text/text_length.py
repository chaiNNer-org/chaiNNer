from __future__ import annotations

from nodes.properties.inputs import TextInput
from nodes.properties.outputs import NumberOutput

from .. import text_group


@text_group.register(
    schema_id="chainner:utility:text_length",
    name="文本长度",
    description="返回文本字符串中的字符数。",
    icon="MdTextFields",
    inputs=[
        TextInput("文本"),
    ],
    outputs=[
        NumberOutput("长度", output_type="string::len(Input0)"),
    ],
)
def text_length_node(text: str) -> int:
    return len(text)
