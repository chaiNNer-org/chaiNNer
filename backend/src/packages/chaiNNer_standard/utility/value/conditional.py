from __future__ import annotations

from api import Lazy
from nodes.properties.inputs import AnyInput, BoolInput
from nodes.properties.outputs import BaseOutput

from .. import value_group


@value_group.register(
    schema_id="chainner:utility:conditional",
    name="Conditional",
    description="Allows you to pass in multiple inputs and then change which one passes through to the output.",
    icon="BsShuffle",
    inputs=[
        BoolInput("Condition", default=True, has_handle=True).with_id(0),
        AnyInput(label="If True").make_lazy(),
        AnyInput(label="If False").make_lazy(),
    ],
    outputs=[
        BaseOutput(
            output_type="""
            if Input0 { Input1 } else { Input2 }
            """,
            label="Value",
        ).as_passthrough_of(1),
    ],
    see_also=["chainner:utility:switch"],
)
def conditional_node(
    cond: bool, if_true: Lazy[object], if_false: Lazy[object]
) -> object:
    return if_true.value if cond else if_false.value
