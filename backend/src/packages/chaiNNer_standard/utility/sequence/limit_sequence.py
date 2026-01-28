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
    sequence: list[T],
    limit: int,
) -> Transformer[T, T]:
    limit = max(limit, 0)
    actual_length = min(limit, len(sequence))

    def supplier() -> Iterable[T]:
        for i, item in enumerate(sequence):
            if i >= limit:
                break
            yield item

    return Transformer(supplier=supplier, expected_length=actual_length)
