from random import Random

from ...node_base import NodeBase, group
from ...node_factory import NodeFactory
from ...properties.inputs import NumberInput
from ...properties.outputs import NumberOutput
from . import category as UtilityCategory


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
        ]
        self.outputs = [
            NumberOutput(
                "Result", output_type="int & max(.., Input0) & min(.., Input1)"
            )
        ]

        self.category = UtilityCategory
        self.name = "Random Number"
        self.icon = "MdCalculate"
        self.sub = "Random"

    def run(self, min_val: int, max_val: int, seed: int) -> int:
        return Random(seed).randint(min_val, max_val)
