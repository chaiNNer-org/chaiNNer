from __future__ import annotations

from api import Collector, IteratorInputInfo
from nodes.properties.inputs import BoolInput
from nodes.properties.outputs import BoolOutput

from .. import sequence_group


@sequence_group.register(
    schema_id="chainner:utility:all_sequence",
    name="All",
    description=[
        "Checks if all items in a boolean sequence are True.",
        "Returns True if every item is True, False otherwise.",
        "Returns True for an empty sequence (vacuous truth).",
    ],
    icon="MdDoneAll",
    kind="collector",
    inputs=[
        BoolInput("Sequence", has_handle=True),
    ],
    iterator_inputs=IteratorInputInfo(inputs=0),
    outputs=[
        BoolOutput(
            "Result",
            output_type="bool",
        )
    ],
)
def all_node(_: None) -> Collector[bool, bool]:
    result = [True]

    def on_iterate(value: bool):
        if not value:
            result[0] = False

    def on_complete():
        return result[0]

    return Collector(on_iterate=on_iterate, on_complete=on_complete)
