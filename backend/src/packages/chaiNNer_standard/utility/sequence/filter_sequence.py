from __future__ import annotations

from collections.abc import Iterable
from typing import TypeVar

from api import IteratorInputInfo, IteratorOutputInfo, Transformer
from nodes.properties.inputs import AnyInput, BoolInput
from nodes.properties.outputs import AnyOutput

from .. import sequence_group

T = TypeVar("T")


@sequence_group.register(
    schema_id="chainner:utility:filter_sequence",
    name="Filter Sequence",
    description=[
        "Filters a sequence based on the supplied condition.",
        "The output sequence will contain only the items that meet the condition.",
    ],
    icon="MdFilterListAlt",
    kind="transformer",
    inputs=[
        AnyInput("Sequence").with_id(0),
        BoolInput("Keep", has_handle=True).with_id(1),
    ],
    outputs=[
        AnyOutput("Sequence", output_type="Input0").with_id(0),
    ],
    iterator_inputs=IteratorInputInfo(inputs=[0, 1], length_type="uint"),
    iterator_outputs=IteratorOutputInfo(outputs=[0], length_type="uint"),
)
def filter_sequence_node(
    sequence: list[T],
    keep_flags: list[bool],
) -> Transformer[T, T]:
    def supplier() -> Iterable[T]:
        for item, keep in zip(sequence, keep_flags, strict=False):
            if keep:
                yield item

    return Transformer(supplier=supplier)
