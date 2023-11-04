from __future__ import annotations

from typing import TYPE_CHECKING

from nodes.properties.inputs import ModelInput
from nodes.properties.outputs import NumberOutput

from .. import utility_group

if TYPE_CHECKING:
    from nodes.impl.pytorch.types import PyTorchModel


@utility_group.register(
    schema_id="chainner:pytorch:model_dim",
    name="Get Model Scale",
    description="""Returns the scale of a PyTorch model.""",
    icon="BsRulers",
    inputs=[ModelInput()],
    outputs=[NumberOutput("Scale", output_type="Input0.scale")],
)
def get_model_scale_node(model: PyTorchModel) -> int:
    return model.scale
