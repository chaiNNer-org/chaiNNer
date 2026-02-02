from __future__ import annotations

from api import Collector, IteratorInputInfo
from nodes.properties.inputs import BoolInput
from nodes.properties.outputs import BoolOutput

from .. import sequence_group


@sequence_group.register(
    schema_id="chainner:utility:any_sequence",
    name="Any",
    description=[
        "Checks if any item in a boolean sequence is True.",
        "Returns True if at least one item is True, False otherwise.",
        "Returns False for an empty sequence.",
    ],
    icon="MdOutlineQuestionMark",
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
def any_node(_: None) -> Collector[bool, bool]:
    result = [False]

    def on_iterate(value: bool):
        if value:
            result[0] = True

    def on_complete():
        return result[0]

    return Collector(on_iterate=on_iterate, on_complete=on_complete)
