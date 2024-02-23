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
    name="文本替换",
    description="使用替换文本替换一些文本的出现。将替换所有或所有出现或第一次出现",
    icon="MdTextFields",
    inputs=[
        TextInput("文本"),
        TextInput("旧文本"),
        TextInput("替换", allow_empty_string=True),
        EnumInput(
            ReplacementMode,
            label="替换模式",
            default=ReplacementMode.REPLACE_ALL,
        ),
    ],
    outputs=[
        TextOutput(
            "文本",
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
