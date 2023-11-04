from __future__ import annotations

from typing import TYPE_CHECKING

from nodes.properties.inputs import NcnnModelInput
from nodes.properties.outputs import NumberOutput

from .. import utility_group

if TYPE_CHECKING:
    from nodes.impl.ncnn.model import NcnnModelWrapper


@utility_group.register(
    schema_id="chainner:ncnn:model_dim",
    name="Get Model Scale",
    description="""Returns the scale of an NCNN model.""",
    icon="BsRulers",
    inputs=[NcnnModelInput()],
    outputs=[NumberOutput("Scale", output_type="Input0.scale")],
)
def get_model_scale_node(model: NcnnModelWrapper) -> int:
    return model.scale
