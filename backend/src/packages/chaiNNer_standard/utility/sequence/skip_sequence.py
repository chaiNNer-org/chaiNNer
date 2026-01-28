from __future__ import annotations

from collections.abc import Iterable
from typing import TypeVar

from api import IteratorInputInfo, IteratorOutputInfo, Transformer
from nodes.properties.inputs import AnyInput, NumberInput
from nodes.properties.outputs import AnyOutput

from .. import sequence_group

T = TypeVar("T")


@sequence_group.register(
    schema_id="chainner:utility:skip_sequence",
    name="Skip Sequence",
    description=[
        "Skips the first N items in a sequence.",
        "The output sequence will contain all items after the first N items.",
        "If the input sequence has fewer than N items, the output will be empty.",
    ],
    icon="MdSkipNext",
    kind="transformer",
    inputs=[
        AnyInput("Sequence").with_id(0),
        NumberInput(
            "Skip",
            min=0,
            default=1,
            precision=0,
        ).with_id(1),
    ],
    outputs=[
        AnyOutput("Sequence", output_type="Input0").with_id(0),
    ],
    iterator_inputs=IteratorInputInfo(inputs=[0], length_type="uint"),
    iterator_outputs=IteratorOutputInfo(outputs=[0], length_type="uint"),
)
def skip_sequence_node(
    sequence: list[T],
    skip: int,
) -> Transformer[T, T]:
    skip = max(skip, 0)
    actual_length = max(len(sequence) - skip, 0)

    def supplier() -> Iterable[T]:
        for i, item in enumerate(sequence):
            if i >= skip:
                yield item

    return Transformer(supplier=supplier, expected_length=actual_length)
