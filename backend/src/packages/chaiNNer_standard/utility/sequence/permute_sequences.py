from __future__ import annotations

from collections.abc import Iterable
from itertools import product
from typing import TypeVar

from api import IteratorInputInfo, IteratorOutputInfo, Transformer
from nodes.properties.inputs import AnyInput
from nodes.properties.outputs import AnyOutput

from .. import sequence_group

A = TypeVar("A")
B = TypeVar("B")


@sequence_group.register(
    schema_id="chainner:utility:permute_sequences",
    name="Permute Sequences",
    description=[
        "Computes the Cartesian product of two sequences.",
        "For each item in sequence A and each item in sequence B, "
        "outputs the pair (A item, B item).",
        "The output length is len(A) × len(B).",
    ],
    icon="MdGridOn",
    kind="transformer",
    inputs=[
        AnyInput("Sequence A").with_id(0),
        AnyInput("Sequence B").with_id(1),
    ],
    outputs=[
        AnyOutput("Item A", output_type="Input0").with_id(0),
        AnyOutput("Item B", output_type="Input1").with_id(1),
    ],
    iterator_inputs=IteratorInputInfo(inputs=[0, 1], length_type="uint"),
    iterator_outputs=IteratorOutputInfo(outputs=[0, 1], length_type="uint"),
)
def permute_sequences_node(
    sequence_a: list[A],
    sequence_b: list[B],
) -> Transformer[tuple[A, B], tuple[A, B]]:
    expected_length = len(sequence_a) * len(sequence_b)

    def supplier() -> Iterable[tuple[A, B]]:
        yield from product(sequence_a, sequence_b)

    return Transformer(supplier=supplier, expected_length=expected_length)
