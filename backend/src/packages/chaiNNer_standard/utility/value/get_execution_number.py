from __future__ import annotations

from nodes.properties.inputs.__system_inputs import StaticValueInput
from nodes.properties.inputs.numeric_inputs import get_number_type
from nodes.properties.outputs import NumberOutput

from .. import value_group


@value_group.register(
    schema_id="chainner:utility:execution_number",
    name="Get Execution Number",
    description="Get the current execution number of this session. Increments by 1 every time you press the play button.",
    icon="MdNumbers",
    inputs=[
        StaticValueInput(
            label="Execution Number",
            value_of="execution_number",
            navi_type=get_number_type(
                1,
                None,
                0,
            ),
            py_type=int,
        ).make_fused(),
    ],
    outputs=[
        NumberOutput("Execution Number", output_type="Input0"),
    ],
)
def get_execution_number_node(number: int) -> int:
    return number