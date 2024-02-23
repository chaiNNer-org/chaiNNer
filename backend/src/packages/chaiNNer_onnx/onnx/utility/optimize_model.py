from __future__ import annotations

import onnx

from nodes.impl.onnx.model import OnnxModel, load_onnx_model
from nodes.impl.onnx.utils import safely_optimize_onnx_model
from nodes.properties.inputs import OnnxModelInput
from nodes.properties.outputs import OnnxModelOutput

from .. import utility_group


@utility_group.register(
    schema_id="chainner:onnx:optimize_model",
    name="优化模型",
    description="优化给定的模型。优化可能会或可能不会提高性能。",
    icon="MdSpeed",
    inputs=[
        OnnxModelInput(),
    ],
    outputs=[
        OnnxModelOutput(),
    ],
)
def optimize_model_node(model: OnnxModel) -> OnnxModel:
    model_proto = onnx.load_from_string(model.bytes)
    model_proto = safely_optimize_onnx_model(model_proto)
    model_bytes = model_proto.SerializeToString()
    return load_onnx_model(model_bytes)
