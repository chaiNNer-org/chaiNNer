from __future__ import annotations

from collections.abc import Iterable
from typing import TypeVar

from api import IteratorInputInfo, IteratorOutputInfo, Transformer
from nodes.properties.inputs import AnyInput, NumberInput
from nodes.properties.outputs import AnyOutput

from .. import sequence_group

T = TypeVar("T")


@sequence_group.register(
    schema_id="chainner:utility:slice_sequence",
    name="Slice Sequence",
    description=[
        "Extracts a subsequence from the input sequence using start, stop, and step indices.",
        "Works like Python's slice notation: sequence[start:stop:step].",
        "Negative indices are not supported; use 0 for start and a large number for stop to include all items.",
    ],
    icon="MdContentCut",
    kind="transformer",
    inputs=[
        AnyInput("Sequence").with_id(0),
        NumberInput(
            "Start",
            min=0,
            default=0,
            precision=0,
        ).with_id(1),
        NumberInput(
            "Stop",
            min=0,
            default=10,
            precision=0,
        ).with_id(2),
        NumberInput(
            "Step",
            min=1,
            default=1,
            precision=0,
        ).with_id(3),
    ],
    outputs=[
        AnyOutput("Sequence", output_type="Input0").with_id(0),
    ],
    iterator_inputs=IteratorInputInfo(inputs=[0], length_type="uint"),
    iterator_outputs=IteratorOutputInfo(outputs=[0], length_type="uint"),
)
def slice_sequence_node(
    sequence: list[T],
    start: int,
    stop: int,
    step: int,
) -> Transformer[T, T]:
    start = max(start, 0)
    stop = max(stop, 0)
    step = max(step, 1)

    # Calculate expected length using the same logic as Python's range
    effective_stop = min(stop, len(sequence))
    if start >= effective_stop:
        expected_length = 0
    else:
        expected_length = (effective_stop - start + step - 1) // step

    def supplier() -> Iterable[T]:
        for i in range(start, min(stop, len(sequence)), step):
            yield sequence[i]

    return Transformer(supplier=supplier, expected_length=expected_length)
