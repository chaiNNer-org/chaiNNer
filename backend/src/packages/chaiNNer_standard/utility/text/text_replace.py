from __future__ import annotations

from enum import Enum

from nodes.properties.inputs import EnumInput, TextInput
from nodes.properties.outputs import TextOutput

from .. import text_group


class ReplacementMode(Enum):
    REPLACE_ALL = 0
    REPLACE_FIRST = 1


@text_group.register(
    schema_id="chainner:utility:text_replace",
    name="Text Replace",
    description="Replace occurrences of some text with a replacement text. Either or all occurrences or the first occurrence will be replaced",
    icon="MdTextFields",
    inputs=[
        TextInput("Text"),
        TextInput("Old Text"),
        TextInput("Replacement", allow_empty_string=True),
        EnumInput(
            ReplacementMode,
            label="Replace mode",
            default_value=ReplacementMode.REPLACE_ALL,
        ),
    ],
    outputs=[
        TextOutput(
            "Text",
            output_type="""
                let count = match Input3 {
                    ReplacementMode::ReplaceAll => inf,
                    ReplacementMode::ReplaceFirst => 1,
                };
                string::replace(Input0, Input1, Input2, count)
            """,
        ),
    ],
    see_also=["chainner:utility:regex_replace"],
)
def text_replace_node(text: str, old: str, new: str, mode: ReplacementMode) -> str:
    if mode == ReplacementMode.REPLACE_ALL:
        return text.replace(old, new)
    else:
        return text.replace(old, new, 1)
