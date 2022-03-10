"""
Nodes that provide various generic utility
"""

from sanic.log import logger

from .node_base import NodeBase
from .node_factory import NodeFactory
from .properties.inputs import *
from .properties.outputs import *


@NodeFactory.register("Utility", "Note")
class NoteNode(NodeBase):
    """Sticky note node"""

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = "Make a sticky note for whatever notes or comments you want to leave in the chain."
        self.inputs = [NoteTextAreaInput()]
        self.outputs = []
        self.icon = "MdOutlineStickyNote2"
        self.sub = "Miscellaneous"

    def run(self, text: str) -> None:
        return


# @NodeFactory.register("Utility", "Math")
# class MathNode(NodeBase):
#     """Math node"""

#     def __init__(self):
#         """Constructor"""
#         super().__init__()
#         self.description = "Perform mathematical operations on numbers."
#         self.inputs = [
#             NumberInput("Operand A"),
#             MathOpsDropdown(),
#             NumberInput("Operand B"),
#         ]
#         self.outputs = [NumberOutput("Result")]
#         self.icon = "MdCalculate"
#         self.sub = "Miscellaneous"

#     def run(self, in1: str, op: str, in2: str) -> int:
#         in1, in2 = int(in1), int(in2)

#         if op == "add":
#             return in1 + in2
#         elif op == "sub":
#             return in1 - in2
#         elif op == "mul":
#             return in1 * in2
#         elif op == "div":
#             return in1 / in2
#         elif op == "pow":
#             return in1 ** in2
