from __future__ import annotations

from api import KeyInfo
from nodes.properties.inputs import NumberInput
from nodes.properties.outputs import NumberOutput

from .. import value_group


@value_group.register(
    schema_id="chainner:utility:number",
    name="Number",
    description="Outputs the given number.",
    icon="MdCalculate",
    inputs=[
        NumberInput(
            "Number",
            min=None,
            max=None,
            precision=100,
            step=1,
            label_style="hidden",
        ).make_fused(),
    ],
    outputs=[
        NumberOutput("Number", output_type="Input0").suggest(),
    ],
    key_info=KeyInfo.number(0),
)
def number_node(number: float) -> float:
    return number
