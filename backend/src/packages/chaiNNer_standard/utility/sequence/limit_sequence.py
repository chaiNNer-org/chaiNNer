from __future__ import annotations

from collections.abc import Iterable
from typing import TypeVar

from api import IteratorInputInfo, IteratorOutputInfo, Transformer
from nodes.properties.inputs import AnyInput, NumberInput
from nodes.properties.outputs import AnyOutput

from .. import sequence_group

T = TypeVar("T")


@sequence_group.register(
    schema_id="chainner:utility:limit_sequence",
    name="Limit Sequence",
    description=[
        "Limits a sequence to the specified number of items.",
        "The output sequence will contain at most the specified number "
        "of items from the input sequence.",
        "If the input sequence has fewer items than the limit, all items "
        "will be passed through unchanged.",
    ],
    icon="MdFilterList",
    kind="transformer",
    inputs=[
        AnyInput("Sequence").with_id(0),
        NumberInput(
            "Limit",
            min=0,
            default=10,
            precision=0,
        ).with_id(1),
    ],
    outputs=[
        AnyOutput("Sequence", output_type="Input0").with_id(0),
    ],
    iterator_inputs=IteratorInputInfo(inputs=[0], length_type="uint"),
    iterator_outputs=IteratorOutputInfo(outputs=[0], length_type="Input1"),
)
def limit_sequence_node(
    _: None,
    limit: int,
) -> Transformer[T, T]:
    limit = max(limit, 0)
    count = [0]  # Use list to allow modification in nested function

    def on_iterate(item: T) -> Iterable[T]:
        """Yield the item if we haven't reached the limit"""
        if count[0] < limit:
            count[0] += 1
            yield item

    return Transformer(on_iterate=on_iterate, expected_length=limit)
