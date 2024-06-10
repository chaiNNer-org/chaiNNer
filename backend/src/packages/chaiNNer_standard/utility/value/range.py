from __future__ import annotations

from api import Generator, IteratorOutputInfo, KeyInfo
from nodes.properties.inputs import BoolInput, NumberInput
from nodes.properties.outputs import NumberOutput

from .. import value_group


@value_group.register(
    schema_id="chainner:utility:range",
    name="Range",
    description="Iterates through all integers in the given range.",
    icon="MdCalculate",
    inputs=[
        NumberInput("Start", default=0, min=None, max=None),
        BoolInput("Start Inclusive", default=True),
        NumberInput("Stop", default=10, min=None, max=None),
        BoolInput("Stop Inclusive", default=False),
    ],
    outputs=[
        NumberOutput(
            "Number",
            output_type="""
                let start = if Input1 { Input0 } else { Input0 + 1 };
                let stop = if Input3 { Input2 } else { Input2 - 1 };

                max(int, start) & min(int, stop)
            """,
        ).with_never_reason("The range is empty."),
    ],
    key_info=KeyInfo.type(
        """
        let start = if Input1 { Input0 } else { Input0 + 1 };
        let stop = if Input3 { Input2 } else { Input2 - 1 };

        string::concat(toString(start), "..", toString(stop))
        """
    ),
    iterator_outputs=IteratorOutputInfo(outputs=0),
    kind="generator
)
def range_node(
    start: int,
    start_inclusive: bool,
    end: int,
    end_inclusive: bool,
) -> Generator[int]:
    if not start_inclusive:
        start += 1
    if end_inclusive:
        end += 1
    count = end - start
    return Generator.from_range(count, lambda i: start + i)
