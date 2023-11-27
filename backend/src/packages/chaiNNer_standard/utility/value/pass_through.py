"""
Nodes that provide various generic utility
"""

from __future__ import annotations

from nodes.properties.inputs import AnyInput
from nodes.properties.outputs import BaseOutput

from .. import value_group


@value_group.register(
    schema_id="chainner:utility:pass_through",
    name="Pass Through",
    description="Outputs the input value as is.",
    icon="MdDoubleArrow",
    inputs=[
        AnyInput(label="Value").make_fused(),
    ],
    outputs=[
        BaseOutput(output_type="Input0", label="Value"),
    ],
)
def pass_through_node(value: object) -> object:
    return value
