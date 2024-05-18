from __future__ import annotations

from enum import Enum

from api import KeyInfo
from nodes.properties.inputs import EnumInput, NumberInput
from nodes.properties.outputs import BoolOutput

from .. import math_group


class Comparison(Enum):
    EQUAL = 0
    NOT_EQUAL = 1
    LESS = 3
    LESS_EQUAL = 5
    GREATER = 2
    GREATER_EQUAL = 4


@math_group.register(
    schema_id="chainner:utility:compare",
    name="Compare",
    description="Compares the given numbers.",
    icon="MdCalculate",
    inputs=[
        EnumInput(
            Comparison,
            label="Operation",
            option_labels={
                Comparison.EQUAL: "L == R",
                Comparison.NOT_EQUAL: "L == R",
                Comparison.GREATER: "L > R",
                Comparison.LESS: "L < R",
                Comparison.GREATER_EQUAL: "L >= R",
                Comparison.LESS_EQUAL: "L <= R",
            },
            icons={
                Comparison.EQUAL: "=",
                Comparison.NOT_EQUAL: "≠",
                Comparison.GREATER: ">",
                Comparison.LESS: "<",
                Comparison.GREATER_EQUAL: "≥",
                Comparison.LESS_EQUAL: "≤",
            },
            label_style="hidden",
        ).with_id(0),
        NumberInput(
            label="Left",
            minimum=None,
            maximum=None,
            precision=100,
            controls_step=1,
        ).with_id(1),
        NumberInput(
            label="Right",
            minimum=None,
            maximum=None,
            precision=100,
            controls_step=1,
        ).with_id(2),
    ],
    outputs=[
        BoolOutput(
            label="Result",
            output_type="""
            let op = Input0;
            let l = Input1;
            let r = Input2;

            match op {
                Comparison::Equal => l == r,
                Comparison::NotEqual => l != r,
                Comparison::Greater => l > r,
                Comparison::Less => l < r,
                Comparison::GreaterEqual => l >= r,
                Comparison::LessEqual => l <= r,
            }
            """,
        ).suggest(),
    ],
    key_info=KeyInfo.enum(0),
)
def compare_node(op: Comparison, left: float, right: float) -> bool:
    if op == Comparison.EQUAL:
        return left == right
    elif op == Comparison.NOT_EQUAL:
        return left != right
    elif op == Comparison.GREATER:
        return left > right
    elif op == Comparison.LESS:
        return left < right
    elif op == Comparison.GREATER_EQUAL:
        return left >= right
    elif op == Comparison.LESS_EQUAL:
        return left <= right
