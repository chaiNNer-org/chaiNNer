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
    name="Text Slice",
    description="Creates a slice of a given string of text.",
    icon="MdTextFields",
    inputs=[
        TextInput("Text"),
        EnumInput(
            SliceOperation,
            label="Operation",
            default_value=SliceOperation.START,
            option_labels={
                SliceOperation.START: "Start",
                SliceOperation.START_AND_LENGTH: "Start & Length",
                SliceOperation.MAX_LENGTH: "Maximum Length",
            },
        ).with_id(1),
        if_enum_group(1, (SliceOperation.START, SliceOperation.START_AND_LENGTH))(
            NumberInput("Start", minimum=None, maximum=None, unit="chars"),
        ),
        if_enum_group(1, SliceOperation.START_AND_LENGTH)(
            NumberInput("Length", minimum=0, maximum=None, unit="chars"),
        ),
        if_enum_group(1, SliceOperation.MAX_LENGTH)(
            NumberInput("Maximum Length", minimum=0, maximum=None, unit="chars"),
            EnumInput(SliceAlignment, label="Alignment"),
        ),
    ],
    outputs=[
        TextOutput(
            "Output Text",
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
