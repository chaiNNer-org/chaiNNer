from __future__ import annotations

from collections.abc import Iterable
from typing import TypeVar

from api import IteratorInputInfo, IteratorOutputInfo, Transformer
from nodes.properties.inputs import AnyInput
from nodes.properties.outputs import AnyOutput

from .. import sequence_group

A = TypeVar("A")
B = TypeVar("B")


@sequence_group.register(
    schema_id="chainner:utility:interleave_sequences",
    name="Interleave Sequences",
    description=[
        "Interleaves two sequences by alternating their items.",
        "For sequences [A1, A2, A3] and [B1, B2, B3], outputs [A1, B1, A2, B2, A3, B3].",
        "If one sequence is shorter, remaining items from the longer sequence are appended.",
    ],
    icon="MdSyncAlt",
    kind="transformer",
    inputs=[
        AnyInput("Sequence A").with_id(0),
        AnyInput("Sequence B").with_id(1),
    ],
    outputs=[
        AnyOutput("Item", output_type="Input0 | Input1").with_id(0),
    ],
    iterator_inputs=IteratorInputInfo(inputs=[0, 1], length_type="uint"),
    iterator_outputs=IteratorOutputInfo(outputs=[0], length_type="uint"),
)
def interleave_sequences_node(
    sequence_a: Iterable[A],
    sequence_b: Iterable[B],
) -> Transformer[A | B, A | B]:
    def supplier() -> Iterable[A | B]:
        iter_a = iter(sequence_a)
        iter_b = iter(sequence_b)
        a_exhausted = False
        b_exhausted = False

        while not (a_exhausted and b_exhausted):
            if not a_exhausted:
                try:
                    yield next(iter_a)
                except StopIteration:
                    a_exhausted = True
            if not b_exhausted:
                try:
                    yield next(iter_b)
                except StopIteration:
                    b_exhausted = True

    return Transformer(supplier=supplier)
