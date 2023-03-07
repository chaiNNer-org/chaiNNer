from __future__ import annotations

from enum import Enum

from ...groups import conditional_group
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import EnumInput, NumberInput, TextInput
from ...properties.outputs import TextOutput
from . import category as UtilityCategory


class SliceOperation(Enum):
    START = 0
    START_AND_LENGTH = 1
    MAX_LENGTH = 2


class SliceAlignment(Enum):
    START = "start"
    END = "end"


@NodeFactory.register("chainner:utility:text_slice")
class TextSliceNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Creates a slice of a given string of text."
        self.inputs = [
            TextInput("Text", min_length=0),
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
            conditional_group(
                enum=1,
                condition=(
                    SliceOperation.START.value,
                    SliceOperation.START_AND_LENGTH.value,
                ),
            )(
                NumberInput("Start", minimum=None, maximum=None, unit="chars"),
            ),
            conditional_group(enum=1, condition=SliceOperation.START_AND_LENGTH.value)(
                NumberInput("Length", minimum=0, maximum=None, unit="chars"),
            ),
            conditional_group(enum=1, condition=SliceOperation.MAX_LENGTH.value)(
                NumberInput("Maximum Length", minimum=0, maximum=None, unit="chars"),
                EnumInput(SliceAlignment, label="Alignment"),
            ),
        ]
        self.outputs = [
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
        ]

        self.category = UtilityCategory
        self.name = "Text Slice"
        self.icon = "MdTextFields"
        self.sub = "Text"

    def run(
        self,
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
