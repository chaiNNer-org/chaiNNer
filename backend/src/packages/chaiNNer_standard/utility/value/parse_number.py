from __future__ import annotations

from nodes.properties.inputs import NumberInput, TextInput
from nodes.properties.outputs import NumberOutput

from .. import value_group


@value_group.register(
    schema_id="chainner:utility:parse_number",
    name="解析数字",
    description="将文本解析为十进制数字。",
    icon="MdCalculate",
    inputs=[
        TextInput("文本", label_style="inline"),
        NumberInput("基数", default=10, minimum=2, maximum=36),
    ],
    outputs=[
        NumberOutput(
            "数值",
            output_type="int & number::parseInt(Input0, Input1)",
        ).with_never_reason("无法将给定文本解析为数字。"),
    ],
)
def parse_number_node(text: str, base: int) -> int:
    return int(text, base)
