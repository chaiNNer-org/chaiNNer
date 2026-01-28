from __future__ import annotations

from collections.abc import Iterable
from typing import TypeVar

from api import IteratorInputInfo, IteratorOutputInfo, Transformer
from nodes.properties.inputs import AnyInput
from nodes.properties.outputs import AnyOutput

from .. import sequence_group

T = TypeVar("T")


@sequence_group.register(
    schema_id="chainner:utility:reverse_sequence",
    name="Reverse Sequence",
    description=[
        "Reverses the order of items in a sequence.",
        "The first item becomes last and the last item becomes first.",
        "Note: The sequence must be buffered in memory to reverse it.",
    ],
    icon="MdSwapVert",
    kind="transformer",
    inputs=[
        AnyInput("Sequence").with_id(0),
    ],
    outputs=[
        AnyOutput("Sequence", output_type="Input0").with_id(0),
    ],
    iterator_inputs=IteratorInputInfo(inputs=[0], length_type="uint"),
    iterator_outputs=IteratorOutputInfo(outputs=[0], length_type="uint"),
)
def reverse_sequence_node(
    sequence: Iterable[T],
) -> Transformer[T, T]:
    def supplier() -> Iterable[T]:
        # Buffer the sequence since we need to reverse it
        items = list(sequence)
        yield from reversed(items)

    return Transformer(supplier=supplier)
