from __future__ import annotations

import gc
from typing import Tuple

import torch
import numpy as np
from sanic.log import logger

from ...categories import PyTorchCategory
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import ModelInput, SliderInput
from ...properties.outputs import ModelOutput, NumberOutput
from ...utils.torch_types import PyTorchModel
from ...utils.pytorch_model_loading import load_state_dict
from ...utils.utils import np2tensor, tensor2np


@NodeFactory.register("chainner:pytorch:interpolate_models")
class InterpolateNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = """Interpolate two of the same kind of model state-dict
             together. Note: models must share a common 'pretrained model' ancestor
             in order to be interpolatable."""
        self.inputs = [
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
        ]
        self.outputs = [
            ModelOutput(model_type="Input0 & Input1").with_never_reason(
                "Models must be of the same type and have the same parameters to be interpolated."
            ),
            NumberOutput("Amount A", "100 - Input2"),
            NumberOutput("Amount B", "Input2"),
        ]

        self.category = PyTorchCategory
        self.name = "Interpolate Models"
        self.icon = "BsTornado"
        self.sub = "Utility"

    def perform_interp(self, model_a: dict, model_b: dict, amount: int):
        try:
            amount_b = amount / 100
            amount_a = 1 - amount_b

            state_dict = dict()
            for k, v_1 in model_a.items():
                v_2 = model_b[k]
                state_dict[k] = (amount_a * v_1) + (amount_b * v_2)
            return state_dict
        except:
            # pylint: disable=raise-missing-from
            raise ValueError(
                "These models are not compatible and able not able to be interpolated together"
            )

    def check_can_interp(self, model_a: dict, model_b: dict):
        a_keys = model_a.keys()
        b_keys = model_b.keys()
        if a_keys != b_keys:
            return False
        interp_50 = self.perform_interp(model_a, model_b, 50)
        model = load_state_dict(interp_50).cpu()
        fake_img = np.ones((3, 3, model.in_nc), dtype=np.float32)
        del interp_50
        with torch.no_grad():
            img_tensor = np2tensor(fake_img, change_range=True).cpu()
            t_out = model(img_tensor)
            result = tensor2np(t_out.detach(), change_range=False, imtype=np.float32)
        del model, img_tensor, t_out, fake_img
        mean_color = np.mean(result)
        del result
        gc.collect()
        return mean_color > 0.5

    def run(
        self, model_a: PyTorchModel, model_b: PyTorchModel, amount: int
    ) -> Tuple[PyTorchModel, int, int]:
        if amount == 0:
            return model_a, 100, 0
        elif amount == 100:
            return model_b, 0, 100

        state_a = model_a.state
        state_b = model_b.state

        logger.info(f"Interpolating models...")
        if not self.check_can_interp(state_a, state_b):
            raise ValueError(
                "These models are not compatible and not able to be interpolated together"
            )

        state_dict = self.perform_interp(state_a, state_b, amount)
        model = load_state_dict(state_dict)

        return model, 100 - amount, amount
