from __future__ import annotations

from enum import Enum

from chainner_ext import RustRegex

from nodes.impl.rust_regex import match_to_replacements_dict
from nodes.properties.inputs import EnumInput, TextInput
from nodes.properties.outputs import TextOutput
from nodes.utils.replacement import ReplacementString

from .. import text_group


class ReplacementMode(Enum):
    REPLACE_ALL = 0
    REPLACE_FIRST = 1


@text_group.register(
    schema_id="chainner:utility:regex_replace",
    name="Regex Replace",
    description="Replace occurrences of some regex with a replacement text. Either or all occurrences or the first occurrence will be replaced",
    icon="MdTextFields",
    inputs=[
        TextInput("Text"),
        TextInput("Regex", placeholder=r'E.g. "\b\w+\b"'),
        TextInput(
            "Replacement Pattern",
            allow_empty_string=True,
            placeholder=r'E.g. "found {0}"',
        ),
        EnumInput(
            ReplacementMode,
            label="Replace mode",
            default=ReplacementMode.REPLACE_ALL,
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
                regexReplace(Input0, Input1, Input2, count)
            """,
        ).with_never_reason(
            "Either the regex pattern or the replacement pattern is invalid"
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

    result = ""
    last_end = 0
    for match in matches:
        result += text[last_end : match.start]
        result += replacement.replace(match_to_replacements_dict(r, match, text))
        last_end = match.end

    result += text[last_end:]
    return result
