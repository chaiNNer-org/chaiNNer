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
    icon="MdFilterList",
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
    _: None,
    __: None,
) -> Transformer[T, T]:
    def on_iterate(item: T, keep: bool) -> Iterable[T]:
        """Yield the item if we are to keep it"""
        if keep:
            yield item

    return Transformer(on_iterate=on_iterate)
