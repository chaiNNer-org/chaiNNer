from __future__ import annotations

from copy import deepcopy

import numpy as np
import onnx
from google.protobuf.internal.containers import RepeatedCompositeFieldContainer
from onnx import numpy_helper as onph
from onnx.onnx_pb import TensorProto
from logger import get_logger_from_env

logger = get_logger_from_env()

from api import NodeContext
from nodes.impl.onnx.load import load_onnx_model
from nodes.impl.onnx.model import OnnxModel
from nodes.impl.onnx.utils import safely_optimize_onnx_model
from nodes.impl.upscale.auto_split_tiles import NO_TILING
from nodes.properties.inputs import OnnxModelInput, SliderInput
from nodes.properties.outputs import NumberOutput, OnnxModelOutput

from .. import utility_group
from ..processing.upscale_image import upscale_image_node


def perform_interp(
    model_a_weights: RepeatedCompositeFieldContainer,
    model_b_weights: RepeatedCompositeFieldContainer,
    amount: float,
) -> list[TensorProto]:
    amount_b = amount / 100
    amount_a = 1 - amount_b

    interp_weights_list = []
    for weight_a, weight_b in zip(model_a_weights, model_b_weights):
        weight_name = weight_b.name
        weight_array_a = onph.to_array(weight_a)
        weight_array_b = onph.to_array(weight_b)

        assert (
            weight_array_a.shape == weight_array_b.shape
        ), "Weights must have same size and shape"

        weight_array_interp = (
            weight_array_a * amount_a + weight_array_b * amount_b
        ).astype(weight_array_a.dtype)
        weight_interp = onph.from_array(weight_array_interp, weight_name)
        interp_weights_list.append(weight_interp)

    return interp_weights_list


def check_will_upscale(context: NodeContext, model: OnnxModel):
    if model.sub_type != "Generic":
        return True
    fake_img = np.ones((3, 3, 3), dtype=np.float32, order="F")
    result = upscale_image_node(context, fake_img, model, NO_TILING, 0, False)

    mean_color = np.mean(result)
    del result
    return mean_color > 0.5


@utility_group.register(
    schema_id="chainner:onnx:interpolate_models",
    name="Interpolate Models",
    description="Interpolate two ONNX models of the same type together. \
            Note: models must share a common 'pretrained model' ancestor \
            in order to be interpolatable.",
    icon="BsTornado",
    inputs=[
        OnnxModelInput("Model A"),
        OnnxModelInput("Model B"),
        SliderInput(
            "Weights",
            step=5,
            slider_step=1,
            max=100,
            default=50,
            unit="%",
            note_expression="`Model A ${100 - value}% ― Model B ${value}%`",
            ends=("A", "B"),
        ),
    ],
    outputs=[
        OnnxModelOutput(),
        NumberOutput("Amount A", output_type="100 - Input2"),
        NumberOutput("Amount B", output_type="Input2"),
    ],
    node_context=True,
)
def interpolate_models_node(
    context: NodeContext,
    a: OnnxModel,
    b: OnnxModel,
    amount: int,
) -> tuple[OnnxModel, int, int]:
    if amount == 0:
        return a, 100, 0
    elif amount == 100:
        return b, 0, 100

    # Just to be sure there is no mismatch from opt/un-opt models
    model_proto_a = onnx.load_from_string(a.bytes)
    model_proto_a = safely_optimize_onnx_model(model_proto_a)
    model_a_weights = model_proto_a.graph.initializer

    model_proto_b = onnx.load_from_string(b.bytes)
    model_proto_b = safely_optimize_onnx_model(model_proto_b)
    model_b_weights = model_proto_b.graph.initializer

    assert len(model_a_weights) == len(
        model_b_weights
    ), "Models must have same number of weights"

    logger.debug("Interpolating models...")
    interp_weights_list = perform_interp(model_a_weights, model_b_weights, amount)

    model_proto_interp = deepcopy(model_proto_b)
    for _ in range(len(model_proto_interp.graph.initializer)):  # type: ignore
        # Assigning a new value or assigning to field index do not seem to work
        model_proto_interp.graph.initializer.pop()  # type: ignore
    model_proto_interp.graph.initializer.extend(interp_weights_list)  # type: ignore

    model = load_onnx_model(model_proto_interp)
    if not check_will_upscale(context, model):
        raise ValueError(
            "These models are not compatible and not able to be interpolated together"
        )

    return model, 100 - amount, amount
