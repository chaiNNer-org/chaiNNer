from __future__ import annotations

from typing import Union

from ...group import group
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import TextInput
from ...properties.outputs import TextOutput
from ...utils.replacement import ReplacementString
from . import category as UtilityCategory


@NodeFactory.register("chainner:utility:text_pattern")
class TextPatternNode(NodeBase):
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
                formatPattern(
                    Input0,
                    Input1,
                    Input2,
                    Input3,
                    Input4,
                    Input5,
                    Input6,
                    Input7,
                    Input8,
                    Input9
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
        *args: Union[str, None],
    ) -> str:
        replacements: dict[str, str] = {}
        for i, s in enumerate(args):
            if s is not None:
                replacements[str(i + 1)] = s

        return ReplacementString(pattern).replace(replacements)
