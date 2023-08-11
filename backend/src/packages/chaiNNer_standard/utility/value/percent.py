from __future__ import annotations

from nodes.properties.inputs import SliderInput
from nodes.properties.outputs import NumberOutput

from .. import value_group


@value_group.register(
    schema_id="chainner:utility:percent",
    name="Percent",
    description="Outputs the given percent.",
    icon="MdCalculate",
    inputs=[
        SliderInput(
            "Percent",
            minimum=0,
            maximum=100,
            default=50,
            precision=0,
            controls_step=1,
            unit="%",
        ),
    ],
    outputs=[
        NumberOutput("%", output_type="Input0"),
    ],
)
def percent_node(number: float) -> float:
    return number
