from __future__ import annotations

from spandrel import ModelDescriptor

from nodes.properties.inputs import ModelInput
from nodes.properties.outputs import NumberOutput, TextOutput

from .. import utility_group


@utility_group.register(
    schema_id="chainner:pytorch:model_dim",
    name="Get Model Info",
    description="""Returns the purpose, architecture and scale of a PyTorch model.""",
    icon="ImInfo",
    inputs=[ModelInput()],
    outputs=[
        NumberOutput("Scale", output_type="Input0.scale"),
        TextOutput("Architecture", output_type="Input0.arch"),
        TextOutput("Purpose", output_type="Input0.subType"),
    ],
)
def get_model_info_node(model: ModelDescriptor) -> tuple[int, string, string]:
    return (model.scale, model.architecture.name, model.purpose)
