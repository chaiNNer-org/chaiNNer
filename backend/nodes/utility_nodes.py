"""
Nodes that provide various generic utility
"""


from .categories import UTILITY

from .node_base import NodeBase
from .node_factory import NodeFactory
from .properties.inputs import *
from .properties.outputs import *


@NodeFactory.register("chainner:utility:note")
class NoteNode(NodeBase):
    """Sticky note node"""

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = "Make a sticky note for whatever notes or comments you want to leave in the chain."
        self.inputs = [NoteTextAreaInput()]
        self.outputs = []

        self.category = UTILITY
        self.name = "Note"
        self.icon = "MdOutlineStickyNote2"
        self.sub = "Text"

    def run(self, _text: str) -> None:
        return


@NodeFactory.register("chainner:utility:math")
class MathNode(NodeBase):
    """Math node"""

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = "Perform mathematical operations on numbers."
        self.inputs = [
            NumberInput("Operand A"),
            MathOpsDropdown(),
            NumberInput("Operand B"),
        ]
        self.outputs = [NumberOutput("Result")]

        self.category = UTILITY
        self.name = "Math"
        self.icon = "MdCalculate"
        self.sub = "Math"

    def run(self, in1: int, op: str, in2: int) -> int:
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
        else:
            raise RuntimeError(f"Unknown operator {op}")


@NodeFactory.register("chainner:utility:text_append")
class TextAppendNode(NodeBase):
    """Text Append node"""

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = "Append different text together using a separator string."
        self.inputs = [
            TextInput("Separator", has_handle=False, max_length=3),
            TextInput("Text A"),
            TextInput("Text B"),
            TextInput("Text C", optional=True),
            TextInput("Text D", optional=True),
        ]
        self.outputs = [TextOutput("Output Text")]

        self.category = UTILITY
        self.name = "Text Append"
        self.icon = "MdTextFields"
        self.sub = "Text"

    def run(
        self,
        separator: str,
        str1: str,
        str2: str,
        str3: str = None,
        str4: str = None,
    ) -> str:
        strings = [
            str(x) for x in [str1, str2, str3, str4] if x != "" and x is not None
        ]
        return separator.join(strings)
