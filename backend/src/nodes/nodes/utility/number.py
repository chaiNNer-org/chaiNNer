from __future__ import annotations

from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import NumberInput
from ...properties.outputs import NumberOutput
from . import category as UtilityCategory


@NodeFactory.register("chainner:utility:number")
class NumberValueNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Outputs the given number."
        self.inputs = [
            NumberInput(
                "Number",
                minimum=None,
                maximum=None,
                precision=100,
                controls_step=1,
            ),
        ]
        self.outputs = [
            NumberOutput("Number", output_type="Input0"),
        ]

        self.category = UtilityCategory
        self.name = "Number"
        self.icon = "MdCalculate"
        self.sub = "Value"

    def run(self, number: int | float) -> int | float:
        return number
