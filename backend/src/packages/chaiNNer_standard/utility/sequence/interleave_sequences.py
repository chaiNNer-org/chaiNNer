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
    sequence_a: list[A],
    sequence_b: list[B],
) -> Transformer[A | B, A | B]:
    expected_length = len(sequence_a) + len(sequence_b)

    def supplier() -> Iterable[A | B]:
        # Interleave items from both sequences
        i = 0
        j = 0
        while i < len(sequence_a) or j < len(sequence_b):
            if i < len(sequence_a):
                yield sequence_a[i]
                i += 1
            if j < len(sequence_b):
                yield sequence_b[j]
                j += 1

    return Transformer(supplier=supplier, expected_length=expected_length)
