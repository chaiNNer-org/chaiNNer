from __future__ import annotations

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
            minimum=None,
            maximum=None,
            precision=100,
            controls_step=1,
            hide_label=True,
        ).fused(),
    ],
    outputs=[
        NumberOutput("Number", output_type="Input0"),
    ],
)
def number_node(number: float) -> float:
    return number
