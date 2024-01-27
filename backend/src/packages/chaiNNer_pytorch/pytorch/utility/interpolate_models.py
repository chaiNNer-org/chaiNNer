from __future__ import annotations

import gc

import numpy as np
import torch
from sanic.log import logger
from spandrel import (
    ImageModelDescriptor,
    MaskedImageModelDescriptor,
    ModelDescriptor,
    ModelLoader,
)

from api.node_context import NodeContext
from nodes.impl.pytorch.utils import np2tensor, tensor2np
from nodes.properties.inputs import ModelInput, SliderInput
from nodes.properties.outputs import ModelOutput, NumberOutput
from packages.chaiNNer_pytorch.settings import get_settings

from .. import utility_group


def perform_interp(model_a: dict, model_b: dict, amount: int):
    try:
        amount_b = amount / 100
        amount_a = 1 - amount_b

        state_dict = {}
        for k, v_1 in model_a.items():
            v_2 = model_b[k]
            state_dict[k] = (amount_a * v_1) + (amount_b * v_2)
        return state_dict
    except Exception as e:
        raise ValueError(
            "These models are not compatible and able not able to be interpolated together"
        ) from e


def check_can_interp(model_a: dict, model_b: dict):
    a_keys = model_a.keys()
    b_keys = model_b.keys()
    if a_keys != b_keys:
        return False
    interp_50 = perform_interp(model_a, model_b, 50)
    model_descriptor = ModelLoader(torch.device("cpu")).load_from_state_dict(interp_50)
    size = max(model_descriptor.size_requirements.minimum, 3)
    size = size + (size % model_descriptor.size_requirements.multiple_of)
    assert isinstance(size, int), "min_size_restriction must be an int"
    fake_img = np.ones((size, size, model_descriptor.input_channels), dtype=np.float32)
    del interp_50
    with torch.no_grad():
        img_tensor = np2tensor(fake_img, change_range=True).cpu()
        if isinstance(model_descriptor, MaskedImageModelDescriptor):
            np.ones((size, size, 1), dtype=np.float32)
            mask_tensor = np2tensor(fake_img, change_range=True).cpu()
            t_out = model_descriptor(img_tensor, mask_tensor)
        elif isinstance(model_descriptor, ImageModelDescriptor):  # type: ignore <- I get that this can technically never happen, but please just let me write exhaustive checks
            t_out = model_descriptor(img_tensor)
        else:
            logger.warning(
                "Unknown model type used with interpolation. Since we cannot verify inference works with this model, we will assume the interpolation is valid. Please report."
            )
            return True
        if isinstance(t_out, tuple):
            t_out = t_out[0]
        result = tensor2np(t_out.detach(), change_range=False, imtype=np.float32)
    del model_descriptor, img_tensor, t_out, fake_img
    mean_color = np.mean(result)
    del result
    gc.collect()
    return mean_color > 0.5


@utility_group.register(
    schema_id="chainner:pytorch:interpolate_models",
    name="Interpolate Models",
    description="""Interpolate two of the same kind of model state-dict
             together. Note: models must share a common 'pretrained model' ancestor
             in order to be interpolatable.""",
    icon="BsTornado",
    inputs=[
        ModelInput("Model A"),
        ModelInput("Model B"),
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
        ModelOutput(model_type="Input0 & Input1").with_never_reason(
            "Models must be of the same type and have the same parameters to be interpolated."
        ),
        NumberOutput("Amount A", output_type="100 - Input2"),
        NumberOutput("Amount B", output_type="Input2"),
    ],
    node_context=True,
)
def interpolate_models_node(
    context: NodeContext,
    model_a: ModelDescriptor,
    model_b: ModelDescriptor,
    amount: int,
) -> tuple[ModelDescriptor, int, int]:
    if amount == 0:
        return model_a, 100, 0
    elif amount == 100:
        return model_b, 0, 100

    state_a = model_a.model.state_dict()
    state_b = model_b.model.state_dict()

    logger.debug("Interpolating models...")
    if not check_can_interp(state_a, state_b):
        raise ValueError(
            "These models are not compatible and not able to be interpolated together"
        )

    state_dict = perform_interp(state_a, state_b, amount)

    exec_options = get_settings(context)
    pytorch_device = exec_options.device

    model = ModelLoader(pytorch_device).load_from_state_dict(state_dict)

    return model, 100 - amount, amount
