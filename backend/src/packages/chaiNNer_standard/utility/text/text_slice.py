from __future__ import annotations

from enum import Enum

from nodes.groups import if_enum_group
from nodes.properties.inputs import EnumInput, NumberInput, TextInput
from nodes.properties.outputs import TextOutput

from .. import text_group


class SliceOperation(Enum):
    START = 0
    START_AND_LENGTH = 1
    MAX_LENGTH = 2


class SliceAlignment(Enum):
    START = "start"
    END = "end"


@text_group.register(
    schema_id="chainner:utility:text_slice",
    name="文本切片",
    description="从给定的文本字符串创建一个切片。",
    icon="MdTextFields",
    inputs=[
        TextInput("文本"),
        EnumInput(
            SliceOperation,
            label="操作",
            default=SliceOperation.START,
            option_labels={
                SliceOperation.START: "起始",
                SliceOperation.START_AND_LENGTH: "起始和长度",
                SliceOperation.MAX_LENGTH: "最大长度",
            },
        ).with_id(1),
        if_enum_group(1, (SliceOperation.START, SliceOperation.START_AND_LENGTH))(
            NumberInput("起始", minimum=None, maximum=None, unit="字符"),
        ),
        if_enum_group(1, SliceOperation.START_AND_LENGTH)(
            NumberInput("长度", minimum=0, maximum=None, unit="字符"),
        ),
        if_enum_group(1, SliceOperation.MAX_LENGTH)(
            NumberInput("最大长度", minimum=0, maximum=None, unit="字符"),
            EnumInput(SliceAlignment, label="对齐"),
        ),
    ],
    outputs=[
        TextOutput(
            "输出文本",
            output_type="""
                let text = Input0;
                let operation = Input1;
                let start = Input2;
                let length = Input3;
                let maxLength = Input4;
                let alignment = Input5;

                match operation {
                    SliceOperation::Start => string::slice(text, start, inf),
                    SliceOperation::StartAndLength => string::slice(text, start, length),
                    SliceOperation::MaxLength => {
                        match alignment {
                            SliceAlignment::Start => string::slice(text, 0, maxLength),
                            SliceAlignment::End => {
                                match maxLength {
                                    0 => "",
                                    _ as maxLength => string::slice(text, -maxLength, inf),
                                }
                            },
                        }
                    },
                }
                """,
        )
    ],
)
def text_slice_node(
    text: str,
    operation: SliceOperation,
    start: int,
    length: int,
    max_length: int,
    alignment: SliceAlignment,
) -> str:
    if operation == SliceOperation.START:
        return text[start:]
    elif operation == SliceOperation.START_AND_LENGTH:
        start = max(-len(text), start)
        return text[start : start + length]
    elif operation == SliceOperation.MAX_LENGTH:
        if max_length == 0:
            return ""
        if alignment == SliceAlignment.START:
            return text[:max_length]
        elif alignment == SliceAlignment.END:
            return text[-max_length:]
