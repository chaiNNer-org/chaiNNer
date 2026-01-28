from __future__ import annotations

from collections.abc import Iterable
from typing import TypeVar

from api import IteratorInputInfo, IteratorOutputInfo, Transformer
from nodes.properties.inputs import AnyInput, NumberInput
from nodes.properties.outputs import AnyOutput, NumberOutput

from .. import sequence_group

T = TypeVar("T")


@sequence_group.register(
    schema_id="chainner:utility:enumerate_sequence",
    name="Enumerate Sequence",
    description=[
        "Adds an index to each item in a sequence.",
        "Outputs both the original item and its index (starting from the specified start value).",
        "Similar to Python's enumerate() function.",
    ],
    icon="MdFormatListNumbered",
    kind="transformer",
    inputs=[
        AnyInput("Sequence").with_id(0),
        NumberInput(
            "Start",
            min=0,
            default=0,
            precision=0,
        ).with_id(1),
    ],
    outputs=[
        AnyOutput("Item", output_type="Input0").with_id(0),
        NumberOutput("Index").with_id(1),
    ],
    iterator_inputs=IteratorInputInfo(inputs=[0], length_type="uint"),
    iterator_outputs=IteratorOutputInfo(outputs=[0, 1], length_type="uint"),
)
def enumerate_sequence_node(
    sequence: list[T],
    start: int,
) -> Transformer[tuple[T, int], tuple[T, int]]:
    expected_length = len(sequence)

    def supplier() -> Iterable[tuple[T, int]]:
        for i, item in enumerate(sequence, start=start):
            yield item, i

    return Transformer(supplier=supplier, expected_length=expected_length)
