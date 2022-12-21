from __future__ import annotations

from typing import Union

from ....api.node_base import NodeBase, group
from ....api.inputs import TextInput
from ....api.outputs import TextOutput
from ....utils.replacement import ReplacementString


class Text_Pattern(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Concatenate text using a pattern with a Python-like string interpolation syntax."
        self.inputs = [
            TextInput("Pattern", has_handle=False, placeholder='E.g. "{1} and {2}"'),
            TextInput("{1}").make_optional(),
            TextInput("{2}").make_optional(),
            group("optional-list")(
                *[
                    TextInput(f"{{{number}}}").make_optional()
                    for number in range(3, 10)
                ],
            ),
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
                    convert(Input4),
                    convert(Input5),
                    convert(Input6),
                    convert(Input7),
                    convert(Input8),
                    convert(Input9)
                )
                """,
            ).with_never_reason(
                "The pattern is either syntactically invalid or contains replacements that do not have a value."
                '\n\nHint: Use "{{" to escape a single "{" inside the pattern.'
            )
        ]

        self.name = "Text Pattern"
        self.icon = "MdTextFields"

    def run(
        self,
        pattern: str,
        *args: Union[str, None],
    ) -> str:
        replacements: dict[str, str] = {}
        for i, s in enumerate(args):
            if s is not None:
                replacements[str(i + 1)] = s

        return ReplacementString(pattern).replace(replacements)
