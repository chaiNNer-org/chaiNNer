from __future__ import annotations
from random import randint, seed
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
                default=100,
            ),
            group("seed")(
                NumberInput(
                    "Seed",
                    minimum=0,
                    maximum=None,
                ),
            ),
            NumberInput(
                "Index from Iterator",
                minimum=0,
                maximum=None,
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

    def run(self, minval: int, maxval: int, seedval: int, frameval: int) -> int:
        seed((frameval + 1) * (seedval + 1))
        return randint(minval, maxval)
