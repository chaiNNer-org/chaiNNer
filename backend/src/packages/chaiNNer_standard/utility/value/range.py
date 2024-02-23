from __future__ import annotations

from api import Iterator, IteratorOutputInfo
from nodes.properties.inputs import BoolInput, NumberInput
from nodes.properties.outputs import NumberOutput

from .. import value_group


@value_group.register(
    schema_id="chainner:utility:range",
    name="范围",
    description="迭代给定范围内的所有整数。",
    icon="MdCalculate",
    inputs=[
        NumberInput("开始", default=0, minimum=None, maximum=None),
        BoolInput("包含开始", default=True),
        NumberInput("结束", default=10, minimum=None, maximum=None),
        BoolInput("包含结束", default=False),
    ],
    outputs=[
        NumberOutput(
            "数字",
            output_type="""
                let start = if Input1 { Input0 } else { Input0 + 1 };
                let stop = if Input3 { Input2 } else { Input2 - 1 };

                max(int, start) & min(int, stop)
            """,
        ).with_never_reason("范围为空。"),
    ],
    iterator_outputs=IteratorOutputInfo(outputs=0),
    kind="newIterator",
)
def range_node(
    start: int,
    start_inclusive: bool,
    end: int,
    end_inclusive: bool,
) -> Iterator[int]:
    if not start_inclusive:
        start += 1
    if end_inclusive:
        end += 1
    count = end - start
    return Iterator.from_range(count, lambda i: start + i)
