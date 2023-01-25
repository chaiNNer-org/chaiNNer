from __future__ import annotations
from random import Random, randint
from . import category as UtilityCategory

from ...node_base import NodeBase, group
from ...node_factory import NodeFactory
from ...properties.inputs import NumberInput
from ...properties.outputs import NumberOutput


@NodeFactory.register("chainner:utility:random_number")
class RandomNumberNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Generate a random integer."
        self.inputs = [
            NumberInput(
                "Minimum Value",
                minimum=None,
                maximum=None,
            ),
            NumberInput(
                "Maximum Value",
                minimum=None,
                maximum=None,
            ),
            group("seed")(
                NumberInput("Seed", minimum=-1, maximum=None, default=-1),
            ),
        ]
        self.outputs = [
            NumberOutput(
                "Result", output_type="int & max(.., Input0) & min(.., Input1)"
            )
        ]

        self.category = UtilityCategory
        self.name = "Random Number"
        self.icon = "MdCalculate"
        self.sub = "Math"

    def run(self, a: int, b: int, c: int) -> int:
        if c == -1:  # random seed
            return randint(a, b)
        else:
            return Random(c).randint(a, b)
