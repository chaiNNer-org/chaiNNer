from __future__ import annotations

from spandrel import ModelDescriptor

from nodes.properties.inputs import ModelInput
from nodes.properties.outputs import TextOutput

from .. import utility_group


@utility_group.register(
    schema_id="chainner:pytorch:model_desc",
    name="Get Model Desc",
    description="""Returns the Network type description of a PyTorch model.""",
    icon="BsRulers",
    inputs=[ModelInput()],
    outputs=[TextOutput("Desc", output_type="Input0.arch")],
)
def get_model_desc_node(model: ModelDescriptor) -> int:
    return model.arch
