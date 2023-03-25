from __future__ import annotations

import numpy as np

from ...impl.normals.addition import AdditionMethod, add_normals
from ...impl.normals.util import xyz_to_bgr
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties import expression
from ...properties.inputs import EnumInput, ImageInput, SliderInput
from ...properties.outputs import ImageOutput
from . import category


@NodeFactory.register("chainner:image:add_normals")
class NormalAdditionNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = """Add 2 normal maps together. Only the R and G
            channels of the input image will be used. The output normal map
            is guaranteed to be normalized."""
        self.inputs = [
            ImageInput("Normal Map 1", channels=[3, 4]),
            SliderInput("Strength 1", maximum=200, default=100),
            ImageInput("Normal Map 2", channels=[3, 4]),
            SliderInput("Strength 2", maximum=200, default=100),
            EnumInput(
                AdditionMethod,
                label="Method",
                default_value=AdditionMethod.PARTIAL_DERIVATIVES,
            ),
        ]
        self.outputs = [
            ImageOutput(
                "Normal Map",
                image_type=expression.Image(
                    width="Input0.width & Input2.width",
                    height="Input0.height & Input2.height",
                ),
                channels=3,
            ).with_never_reason(
                "The given normal maps have different sizes but must be the same size."
            ),
        ]
        self.category = category
        self.name = "Add Normals"
        self.icon = "MdAddCircleOutline"
        self.sub = "Normal Map"

    def run(
        self,
        n1: np.ndarray,
        strength1: int,
        n2: np.ndarray,
        strength2: int,
        method: AdditionMethod,
    ) -> np.ndarray:
        return xyz_to_bgr(
            add_normals(
                method,
                n1,
                n2,
                f1=strength1 / 100,
                f2=strength2 / 100,
            )
        )
