from __future__ import annotations

from api import KeyInfo
from nodes.impl.color.color import Color
from nodes.properties.inputs import ColorInput
from nodes.properties.outputs import ColorOutput

from .. import color_group


@color_group.register(
    schema_id="chainner:utility:color",
    name="Color",
    description="Outputs the given color.",
    icon="MdColorLens",
    inputs=[
        ColorInput().make_fused(),
    ],
    outputs=[
        ColorOutput(color_type="Input0").suggest(),
    ],
    key_info=KeyInfo.type(
        """
        let channels = Input0.channels;
        match channels {
            1 => "Gray",
            3 => "RGB",
            4 => "RGBA",
            _ => never
        }
        """
    ),
)
def color_node(color: Color) -> Color:
    return color
