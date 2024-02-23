from __future__ import annotations

from enum import Enum

from chainner_ext import MatchGroup, RustRegex

from nodes.properties.inputs import EnumInput, TextInput
from nodes.properties.outputs import TextOutput
from nodes.utils.replacement import ReplacementString

from .. import text_group


class ReplacementMode(Enum):
    REPLACE_ALL = 0
    REPLACE_FIRST = 1


@text_group.register(
    schema_id="chainner:utility:regex_replace",
    name="正则表达式替换",
    description="使用替换文本替换一些正则表达式的出现。可以替换所有出现、任意一个出现，或者第一个出现。",
    icon="MdTextFields",
    inputs=[
        TextInput("文本"),
        TextInput("正则表达式", placeholder=r'例如 "\b\w+\b"'),
        TextInput(
            "替换模式",
            allow_empty_string=True,
            placeholder=r'例如 "找到 {0}"',
        ),
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
                regexReplace(Input0, Input1, Input2, count)
            """,
        ).with_never_reason(
            "正则表达式模式或替换模式无效"
        ),
    ],
    see_also=["chainner:utility:text_replace"],
)
def regex_replace_node(
    text: str,
    regex_pattern: str,
    replacement_pattern: str,
    mode: ReplacementMode,
) -> str:
    # parse the inputs before we do any actual work
    r = RustRegex(regex_pattern)
    replacement = ReplacementString(replacement_pattern)

    matches = r.findall(text)
    if len(matches) == 0:
        return text

    if mode == ReplacementMode.REPLACE_FIRST:
        matches = matches[:1]

    def get_group_text(group: MatchGroup | None) -> str:
        if group is not None:
            return text[group.start : group.end]
        else:
            return ""

    result = ""
    last_end = 0
    for match in matches:
        result += text[last_end : match.start]

        replacements: dict[str, str] = {}
        for i in range(r.groups + 1):
            replacements[str(i)] = get_group_text(match.get(i))
        for name, i in r.groupindex.items():
            replacements[name] = get_group_text(match.get(i))

        result += replacement.replace(replacements)
        last_end = match.end

    result += text[last_end:]
    return result
