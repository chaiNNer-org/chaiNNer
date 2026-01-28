from __future__ import annotations

from collections.abc import Iterable
from typing import TypeVar

from api import IteratorInputInfo, IteratorOutputInfo, Transformer
from nodes.properties.inputs import AnyInput, NumberInput
from nodes.properties.outputs import AnyOutput

from .. import sequence_group

T = TypeVar("T")


@sequence_group.register(
    schema_id="chainner:utility:repeat_sequence",
    name="Repeat Sequence",
    description=[
        "Repeats a sequence the specified number of times.",
        "The items are repeated in order: [A, B, C] repeated 2 times becomes [A, B, C, A, B, C].",
        "Note: The sequence must be buffered in memory to repeat it.",
    ],
    icon="MdRepeat",
    kind="transformer",
    inputs=[
        AnyInput("Sequence").with_id(0),
        NumberInput(
            "Times",
            min=0,
            default=2,
            precision=0,
        ).with_id(1),
    ],
    outputs=[
        AnyOutput("Sequence", output_type="Input0").with_id(0),
    ],
    iterator_inputs=IteratorInputInfo(inputs=[0], length_type="uint"),
    iterator_outputs=IteratorOutputInfo(outputs=[0], length_type="uint"),
)
def repeat_sequence_node(
    sequence: Iterable[T],
    times: int,
) -> Transformer[T, T]:
    times = max(times, 0)

    def supplier() -> Iterable[T]:
        # Buffer the sequence since we need to iterate multiple times
        items = list(sequence)
        for _ in range(times):
            yield from items

    return Transformer(supplier=supplier)
