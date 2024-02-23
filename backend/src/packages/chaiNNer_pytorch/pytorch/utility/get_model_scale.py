from __future__ import annotations

from spandrel import ModelDescriptor

from nodes.properties.inputs import ModelInput
from nodes.properties.outputs import NumberOutput

from .. import utility_group


@utility_group.register(
    schema_id="chainner:pytorch:model_dim",
    name="获取模型尺度",
    description="""返回 PyTorch 模型的尺度。""",
    icon="BsRulers",
    inputs=[ModelInput()],
    outputs=[NumberOutput("尺度", output_type="Input0.scale")],
)
def get_model_scale_node(model: ModelDescriptor) -> int:
    return model.scale
