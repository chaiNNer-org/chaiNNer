from __future__ import annotations

from api import IteratorInputInfo, IteratorOutputInfo, Transformer
from nodes.properties.inputs import NumberInput
from nodes.properties.inputs.generic_inputs import AnyInput
from nodes.properties.outputs.generic_outputs import AnyOutput

from .. import value_group


@value_group.register(
    schema_id="chainner:utility:limit_sequence",
    name="Limit Sequence",
    description="Limits the number of items in a sequence. Only the first N items will pass through.",
    icon="MdFilterList",
    inputs=[
        AnyInput("Input"),
        NumberInput("Limit", default=10, min=0, max=None),
    ],
    outputs=[
        AnyOutput("Output", output_type="Input0"),
    ],
    iterator_inputs=IteratorInputInfo(inputs=0),
    iterator_outputs=IteratorOutputInfo(outputs=0),
    kind="transformer",
)
def limit_sequence_node(_: None, limit: int) -> Transformer:
    count = [0]  # Use list to allow mutation in closure

    def transform(value: object) -> list[object]:
        if count[0] < limit:
            count[0] += 1
            return [value]
        return []

    return Transformer(transform=transform)
