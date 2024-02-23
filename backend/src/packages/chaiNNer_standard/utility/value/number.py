from __future__ import annotations

from nodes.properties.inputs import NumberInput
from nodes.properties.outputs import NumberOutput

from .. import value_group


@value_group.register(
    schema_id="chainner:utility:number",
    name="数字",
    description="输出给定的数字。",
    icon="MdCalculate",
    inputs=[
        NumberInput(
            "数字",
            minimum=None,
            maximum=None,
            precision=100,
            controls_step=1,
            label_style="hidden",
        ).make_fused(),
    ],
    outputs=[
        NumberOutput("数字", output_type="Input0"),
    ],
)
def number_node(number: float) -> float:
    return number
