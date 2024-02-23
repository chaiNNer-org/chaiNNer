from __future__ import annotations

from nodes.impl.color.color import Color
from nodes.properties.inputs import ColorInput
from nodes.properties.outputs import ColorOutput

from .. import color_group


@color_group.register(
    schema_id="chainner:utility:color",
    name="颜色",
    description="输出给定的颜色。",
    icon="MdColorLens",
    inputs=[
        ColorInput().make_fused(),
    ],
    outputs=[
        ColorOutput(color_type="Input0"),
    ],
)
def color_node(color: Color) -> Color:
    return color
