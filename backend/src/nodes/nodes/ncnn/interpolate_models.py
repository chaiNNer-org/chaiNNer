from __future__ import annotations

from typing import Tuple

import numpy as np

from ...impl.ncnn.model import NcnnModelWrapper
from ...impl.upscale.auto_split_tiles import NO_TILING
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import NcnnModelInput, SliderInput
from ...properties.outputs import NcnnModelOutput, NumberOutput
from . import category as NCNNCategory
from .upscale_image import NcnnUpscaleImageNode


@NodeFactory.register("chainner:ncnn:interpolate_models")
class NcnnInterpolateModelsNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = """Interpolate two NCNN models of the same type together. Note: models must share a common 'pretrained model' ancestor
             in order to be interpolatable."""
        self.inputs = [
            NcnnModelInput("Model A"),
            NcnnModelInput("Model B"),
            SliderInput(
                "Weights",
                controls_step=5,
                slider_step=1,
                maximum=100,
                default=50,
                unit="%",
                note_expression="`Model A ${100 - value}% ― Model B ${value}%`",
                ends=("A", "B"),
            ),
        ]
        self.outputs = [
            NcnnModelOutput(),
            NumberOutput("Amount A", "100 - Input2"),
            NumberOutput("Amount B", "Input2"),
        ]

        self.category = NCNNCategory
        self.name = "Interpolate Models"
        self.icon = "BsTornado"
        self.sub = "Utility"

    def check_will_upscale(self, interp: NcnnModelWrapper):
        fake_img = np.ones((3, 3, 3), dtype=np.float32, order="F")
        result = NcnnUpscaleImageNode().run(fake_img, interp, NO_TILING)

        mean_color = np.mean(result)
        del result
        return mean_color > 0.5

    def run(
        self, model_a: NcnnModelWrapper, model_b: NcnnModelWrapper, amount: int
    ) -> Tuple[NcnnModelWrapper, int, int]:
        if amount == 0:
            return model_a, 100, 0
        elif amount == 100:
            return model_b, 0, 100

        f_amount = 1 - amount / 100
        interp_model = NcnnModelWrapper(
            model_a.model.interpolate(model_b.model, f_amount)
        )

        if not self.check_will_upscale(interp_model):
            raise ValueError(
                "These NCNN models are not compatible and not able to be interpolated together"
            )

        return interp_model, 100 - amount, amount
