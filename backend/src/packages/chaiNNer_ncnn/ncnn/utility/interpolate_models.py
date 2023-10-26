from __future__ import annotations

import numpy as np
from nodes.impl.ncnn.model import NcnnModelWrapper
from nodes.impl.upscale.auto_split_tiles import NO_TILING
from nodes.properties.inputs import NcnnModelInput, SliderInput
from nodes.properties.outputs import NcnnModelOutput, NumberOutput

from .. import utility_group
from ..processing.upscale_image import upscale_image_node


def check_will_upscale(interp: NcnnModelWrapper):
    fake_img = np.ones((3, 3, 3), dtype=np.float32, order="F")
    result = upscale_image_node(fake_img, interp, NO_TILING, False)

    mean_color = np.mean(result)
    del result
    return mean_color > 0.5


@utility_group.register(
    schema_id="chainner:ncnn:interpolate_models",
    name="Interpolate Models",
    description="""Interpolate two NCNN models of the same type together. Note: models must share a common 'pretrained model' ancestor
             in order to be interpolatable.""",
    icon="BsTornado",
    inputs=[
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
    ],
    outputs=[
        NcnnModelOutput(),
        NumberOutput("Amount A", output_type="100 - Input2"),
        NumberOutput("Amount B", output_type="Input2"),
    ],
)
def interpolate_models_node(
    model_a: NcnnModelWrapper, model_b: NcnnModelWrapper, amount: int
) -> tuple[NcnnModelWrapper, int, int]:
    if amount == 0:
        return model_a, 100, 0
    elif amount == 100:
        return model_b, 0, 100

    f_amount = 1 - amount / 100
    interp_model = NcnnModelWrapper(model_a.model.interpolate(model_b.model, f_amount))

    if not check_will_upscale(interp_model):
        raise ValueError(
            "These NCNN models are not compatible and not able to be interpolated together"
        )

    return interp_model, 100 - amount, amount
