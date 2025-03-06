from __future__ import annotations

from nodes.impl.onnx.model import OnnxModel
from nodes.properties.inputs import OnnxModelInput
from nodes.properties.outputs import NumberOutput, TextOutput

from .. import utility_group


@utility_group.register(
    schema_id="chainner:onnx:model_info",
    name="Get Model Info",
    description="""Returns the scale and purpose of a ONNX model.""",
    icon="ImInfo",
    inputs=[OnnxModelInput("ONNX Model")],
    outputs=[
        NumberOutput(
            "Scale",
            output_type="""
                if Input0.scaleWidth == Input0.scaleHeight {
                    Input0.scaleHeight
                } else {
                    0
                }
                """,
        ),
        TextOutput("Purpose", output_type="Input0.subType"),
    ],
)
def get_model_info_node(model: OnnxModel) -> tuple[int, string]:
    return (
        model.scaleWidth if model.scaleWidth == model.scaleHeight else 0,
        model.subType,
    )
