from __future__ import annotations

from collections.abc import Iterable
from typing import TypeVar

from api import IteratorInputInfo, IteratorOutputInfo, Transformer
from nodes.properties.inputs import AnyInput
from nodes.properties.outputs import AnyOutput

from .. import sequence_group

T = TypeVar("T")


@sequence_group.register(
    schema_id="chainner:utility:deduplicate_sequence",
    name="Deduplicate Sequence",
    description=[
        "Removes duplicate items from a sequence, keeping only the first occurrence.",
        "The order of first occurrences is preserved.",
        "Note: Items must be hashable (numbers, strings, booleans).",
    ],
    icon="MdFilterAlt",
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
def deduplicate_sequence_node(
    sequence: list[T],
) -> Transformer[T, T]:
    def supplier() -> Iterable[T]:
        seen: set[T] = set()
        for item in sequence:
            if item not in seen:
                seen.add(item)
                yield item

    # We can't know the exact length without iterating, so don't provide expected_length
    return Transformer(supplier=supplier)
