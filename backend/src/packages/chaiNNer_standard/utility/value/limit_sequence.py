from __future__ import annotations

from typing import Any

from api.iter import Transformer
from api.node_data import IteratorInputInfo, IteratorOutputInfo
from nodes.properties.inputs.generic_inputs import AnyInput
from nodes.properties.inputs.numeric_inputs import NumberInput
from nodes.properties.outputs.generic_outputs import AnyOutput

from .. import value_group


@value_group.register(
    schema_id="chainner:utility:limit",
    name="Limit Sequence",
    description="Limit the number of items in a sequence.",
    icon="MdTextFields",
    inputs=[
        AnyInput("Sequence"),
        NumberInput(
            "Limit",
            min=0,
            default=0,
        ),
    ],
    outputs=[AnyOutput("Limited Sequence", output_type="Input0")],
    iterator_inputs=[IteratorInputInfo(inputs=0)],
    iterator_outputs=[IteratorOutputInfo(outputs=0)],
    kind="transformer",
)
def limit_sequence_node(_: Any, limit: int) -> Transformer[Any]:
    def transform(items: list[Any]):
        for index, item in enumerate(items):
            if isinstance(item, Exception):
                yield item
            else:
                if limit > 0 and index >= limit:
                    break
                yield item

    return Transformer(transform=transform)
