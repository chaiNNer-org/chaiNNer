"""
Nodes that provide various generic utility
"""

from __future__ import annotations
import math
from typing import Any, Union

from nodes.utils import clipboard

from .categories import UtilityCategory

from .node_base import NodeBase
from .utils.replacement import ReplacementString
from .node_factory import NodeFactory
from .properties.inputs import *
from .properties.outputs import *


@NodeFactory.register("chainner:utility:note")
class NoteNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Make a sticky note for whatever notes or comments you want to leave in the chain."
        self.inputs = [
            NoteTextAreaInput().make_optional(),
        ]
        self.outputs = []

        self.category = UtilityCategory
        self.name = "Note"
        self.icon = "MdOutlineStickyNote2"
        self.sub = "Text"

    def run(self, _text: Union[str, None]) -> None:
        return


@NodeFactory.register("chainner:utility:math")
class MathNode(NodeBase):
    special_mod_numbers = (0.0, float("inf"), float("-inf"), float("nan"))

    def __init__(self):
        super().__init__()
        self.description = "Perform mathematical operations on numbers."
        self.inputs = [
            NumberInput(
                "Operand A",
                minimum=None,
                maximum=None,
                precision=100,
                controls_step=1,
            ),
            MathOpsDropdown(),
            NumberInput(
                "Operand B",
                minimum=None,
                maximum=None,
                precision=100,
                controls_step=1,
            ),
        ]
        self.outputs = [
            NumberOutput(
                "Result",
                output_type="""
                match Input1.operation {
                    "add" => Input0 + Input2,
                    "sub" => Input0 - Input2,
                    "mul" => Input0 * Input2,
                    "div" => Input0 / Input2,
                    "pow" => pow(Input0, Input2),
                    "max" => max(Input0, Input2),
                    "min" => min(Input0, Input2),
                    "mod" => mod(Input0, Input2),
                    _ => number
                }
                """,
            )
        ]

        self.category = UtilityCategory
        self.name = "Math"
        self.icon = "MdCalculate"
        self.sub = "Math"

    def run(
        self, in1: Union[int, float], op: str, in2: Union[int, float]
    ) -> Union[int, float]:
        if op == "add":
            return in1 + in2
        elif op == "sub":
            return in1 - in2
        elif op == "mul":
            return in1 * in2
        elif op == "div":
            return in1 / in2
        elif op == "pow":
            return in1**in2
        elif op == "max":
            return max(in1, in2)
        elif op == "min":
            return min(in1, in2)
        elif op == "mod":
            if (
                in1 in MathNode.special_mod_numbers
                or in2 in MathNode.special_mod_numbers
            ):
                return in1 - in2 * math.floor(in1 / in2)
            else:
                return in1 % in2
        else:
            raise RuntimeError(f"Unknown operator {op}")


@NodeFactory.register("chainner:utility:text_append")
class TextAppendNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Append different text together using a separator string."
        self.inputs = [
            TextInput("Separator", has_handle=False, max_length=3),
            TextInput("Text A"),
            TextInput("Text B"),
            TextInput("Text C").make_optional(),
            TextInput("Text D").make_optional(),
        ]
        self.outputs = [
            TextOutput(
                "Output Text",
                output_type="""
                concat(
                    toString(Input1),
                    toString(Input0),
                    toString(Input2),
                    match Input3 { null => "", _ as s => concat(toString(Input0), toString(s)) },
                    match Input4 { null => "", _ as s => concat(toString(Input0), toString(s)) }
                )
                """,
            )
        ]

        self.category = UtilityCategory
        self.name = "Text Append"
        self.icon = "MdTextFields"
        self.sub = "Text"

    def run(
        self,
        separator: str,
        str1: str,
        str2: str,
        str3: Union[str, None],
        str4: Union[str, None],
    ) -> str:
        strings = [str(x) for x in [str1, str2, str3, str4] if x is not None]
        return separator.join(strings)


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


@NodeFactory.register("chainner:utility:copy_to_clipboard")
class TextClipboardNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Copies the input to the clipboard."
        self.inputs = [
            ClipboardInput(),
        ]
        self.outputs = []

        self.category = UtilityCategory
        self.name = "Copy To Clipboard"
        self.icon = "BsClipboard"
        self.sub = "Clipboard"

        self.side_effects = True

    def run(self, value: Union[str, np.ndarray]) -> None:
        if isinstance(value, np.ndarray):
            clipboard.copy_image(value)
        elif isinstance(value, str):
            clipboard.copy_text(value)
        else:
            raise RuntimeError(f"Unsupported type {type(value)}")


@NodeFactory.register("chainner:utility:pass_through")
class PassThroughNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Outputs the input value as is."
        self.inputs = [AnyInput(label="Value")]
        self.outputs = [BaseOutput(output_type="Input0", label="Value")]

        self.category = UtilityCategory
        self.name = "Pass Through"
        self.icon = "MdDoubleArrow"
        self.sub = "Value"

    def run(self, value: Any) -> Any:
        return value
