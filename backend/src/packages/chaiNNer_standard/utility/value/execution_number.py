from __future__ import annotations

from nodes.properties.inputs.__system_inputs import StaticValueInput
from nodes.properties.outputs import NumberOutput

from .. import value_group


@value_group.register(
    schema_id="chainner:utility:execution_number",
    name="Execution Number",
    description="Get the current execution number of this session. Increments by 1 every time you press the run button.",
    icon="MdNumbers",
    inputs=[
        StaticValueInput(
            label="Value",
            value_of="execution_number",
            navi_type="int(1..)",
            py_type=int,
        ).make_fused(),
    ],
    outputs=[
        NumberOutput("Execution Number", output_type="Input0"),
    ],
)
def execution_number_node(number: int) -> int:
    return number
