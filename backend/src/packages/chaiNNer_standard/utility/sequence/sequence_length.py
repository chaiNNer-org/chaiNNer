from __future__ import annotations

from api import Collector, IteratorInputInfo
from nodes.properties.inputs import AnyInput
from nodes.properties.outputs import NumberOutput

from .. import sequence_group


@sequence_group.register(
    schema_id="chainner:utility:sequence_length",
    name="Sequence Length",
    description=[
        "Counts the number of items in a sequence.",
        "Returns a single number representing the total count.",
    ],
    icon="MdNumbers",
    kind="collector",
    inputs=[
        AnyInput("Sequence"),
    ],
    iterator_inputs=IteratorInputInfo(inputs=0),
    outputs=[
        NumberOutput(
            "Length",
            output_type="uint",
        )
    ],
)
def sequence_length_node(_: None) -> Collector[object, int]:
    count = [0]

    def on_iterate(_item: object):
        count[0] += 1

    def on_complete():
        return count[0]

    return Collector(on_iterate=on_iterate, on_complete=on_complete)
