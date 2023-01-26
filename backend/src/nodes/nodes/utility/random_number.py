from __future__ import annotations
from typing import Union
from random import randint, Random
from . import category as UtilityCategory

from ...node_base import NodeBase, group
from ...node_factory import NodeFactory
from ...properties.inputs import NumberInput, BaseInput
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
            BaseInput(
                input_type="uint", label="Index from Iterator", kind="generic"
            ).make_optional(),
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

    def run(
        self, minval: int, maxval: int, seedval: int, frameval: Union[int, None]
    ) -> int:
        if frameval == None:
            frameval = 0
        return Random((frameval + 1) * (seedval + 1)).randint(minval, maxval)
