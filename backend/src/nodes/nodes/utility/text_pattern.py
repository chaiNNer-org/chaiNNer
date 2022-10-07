from __future__ import annotations

from typing import Union

from . import category as UtilityCategory

from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import TextInput
from ...properties.outputs import TextOutput
from ...utils.replacement import ReplacementString


@NodeFactory.register("chainner:utility:text_pattern")
class TextPatternNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Concatenate text using a pattern with a Python-like string interpolation syntax."
        self.inputs = [
            TextInput("Pattern", has_handle=False, placeholder='E.g. "{1} and {2}"'),
            TextInput("{1}").make_optional(),
            TextInput("{2}").make_optional(),
            TextInput("{3}").make_optional(),
            TextInput("{4}").make_optional(),
        ]
        self.outputs = [
            TextOutput(
                "Output Text",
                output_type="""
                def convert(value: string | number | null) {
                    match value {
                        number as n => toString(n),
                        _ as v => v
                    }
                }

                formatPattern(
                    toString(Input0),
                    convert(Input1),
                    convert(Input2),
                    convert(Input3),
                    convert(Input4)
                )
                """,
            ).with_never_reason(
                "The pattern is either syntactically invalid or contains replacements that do not have a value."
                '\n\nHint: Use "{{" to escape a single "{" inside the pattern.'
            )
        ]

        self.category = UtilityCategory
        self.name = "Text Pattern"
        self.icon = "MdTextFields"
        self.sub = "Text"

    def run(
        self,
        pattern: str,
        str1: Union[str, None],
        str2: Union[str, None],
        str3: Union[str, None],
        str4: Union[str, None],
    ) -> str:
        replacements: dict[str, str] = {}
        for i, s in enumerate([str1, str2, str3, str4]):
            if s is not None:
                replacements[str(i + 1)] = s

        return ReplacementString(pattern).replace(replacements)
