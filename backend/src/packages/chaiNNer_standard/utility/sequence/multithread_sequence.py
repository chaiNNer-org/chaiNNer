from __future__ import annotations

from collections.abc import Iterable
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import TypeVar

from api import IteratorInputInfo, IteratorOutputInfo, Transformer
from nodes.properties.inputs import AnyInput, NumberInput
from nodes.properties.outputs import AnyOutput

from .. import sequence_group

T = TypeVar("T")


@sequence_group.register(
    schema_id="chainner:utility:multithread_sequence",
    name="Multithread Sequence",
    description=[
        "Processes items in the input sequence using multiple threads for improved performance.",
        "Note that the order of output items may not match the input sequence due to concurrent processing.",
    ],
    icon="TbChartArrows",
    kind="transformer",
    inputs=[
        AnyInput("Sequence").with_id(0),
        NumberInput(
            "Number of Threads",
            min=1,
            default=4,
            precision=0,
        ).with_id(1),
    ],
    outputs=[
        AnyOutput("Sequence", output_type="Input0").with_id(0),
    ],
    iterator_inputs=IteratorInputInfo(inputs=[0], length_type="uint"),
    iterator_outputs=IteratorOutputInfo(outputs=[0], length_type="uint"),
)
def multithread_sequence_node(
    sequence: Iterable[T],
    num_threads: int,
) -> Transformer[T, T]:
    def supplier() -> Iterable[T]:
        with ThreadPoolExecutor(max_workers=num_threads) as executor:
            futures = [executor.submit(lambda x: x, item) for item in sequence]
            for future in as_completed(futures):
                yield future.result()

    return Transformer(supplier=supplier)
