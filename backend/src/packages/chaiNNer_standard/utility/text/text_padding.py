from __future__ import annotations

from enum import Enum

from nodes.properties.inputs import EnumInput, NumberInput, TextInput
from nodes.properties.outputs import TextOutput

from .. import text_group


class PaddingAlignment(Enum):
    START = "start"
    END = "end"
    CENTER = "center"


@text_group.register(
    schema_id="chainner:utility:text_padding",
    name="文本填充",
    description="填充文本直到达到特定长度。",
    icon="MdTextFields",
    inputs=[
        TextInput("文本"),
        NumberInput("宽度", unit="字符"),
        TextInput(
            "填充字符",
            has_handle=False,
            allow_numbers=False,
            min_length=1,
            max_length=1,
            placeholder="例如 '0' 或 ' '",
        ),
        EnumInput(PaddingAlignment, label="对齐方式"),
    ],
    outputs=[
        TextOutput(
            "输出文本",
            output_type="""
                match Input3 {
                    PaddingAlignment::Start => padStart(Input0, Input1, Input2),
                    PaddingAlignment::End => padEnd(Input0, Input1, Input2),
                    PaddingAlignment::Center => padCenter(Input0, Input1, Input2),
                }
                """,
        )
    ],
)
def text_padding_node(
    text: str, width: int, padding: str, alignment: PaddingAlignment
) -> str:
    if alignment == PaddingAlignment.START:
        return text.rjust(width, padding)
    elif alignment == PaddingAlignment.END:
        return text.ljust(width, padding)
    elif alignment == PaddingAlignment.CENTER:
        return text.center(width, padding)
    else:
        raise ValueError(f"Invalid alignment '{alignment}'.")
