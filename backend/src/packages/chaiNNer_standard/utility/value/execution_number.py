from __future__ import annotations

from nodes.properties.inputs.__system_inputs import StaticValueInput
from nodes.properties.outputs import NumberOutput

from .. import value_group


@value_group.register(
    schema_id="chainner:utility:execution_number",
    name="执行次数",
    description="获取当前会话的执行次数。每次按运行按钮时递增1。",
    icon="MdNumbers",
    inputs=[
        StaticValueInput(
            label="数值",
            value="execution_number",
            navi_type="int(1..)",
            py_type=int,
        ).make_fused(),
    ],
    outputs=[
        NumberOutput("执行次数", output_type="Input0"),
    ],
)
def execution_number_node(number: int) -> int:
    return number
