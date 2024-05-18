from __future__ import annotations

from api import KeyInfo
from nodes.properties.inputs import SliderInput
from nodes.properties.outputs import NumberOutput

from .. import value_group


@value_group.register(
    schema_id="chainner:utility:percent",
    name="Percent",
    description="Outputs the given percent.",
    icon="MdCalculate",
    inputs=[
        SliderInput("Percent", min=0, max=100, default=50, unit="%").make_fused(),
    ],
    outputs=[
        NumberOutput("Percent", output_type="Input0"),
    ],
    key_info=KeyInfo.number(0),
)
def percent_node(number: int) -> int:
    return number
