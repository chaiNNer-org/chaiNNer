from __future__ import annotations

from typing import TYPE_CHECKING

from nodes.properties.inputs import ColorInput
from nodes.properties.outputs import ColorOutput

from .. import color_group

if TYPE_CHECKING:
    from nodes.impl.color.color import Color


@color_group.register(
    schema_id="chainner:utility:color",
    name="Color",
    description="Outputs the given color.",
    icon="MdColorLens",
    inputs=[
        ColorInput(),
    ],
    outputs=[
        ColorOutput(color_type="Input0"),
    ],
)
def color_node(color: Color) -> Color:
    return color
