from __future__ import annotations

from enum import Enum

from api import BaseInput, Collector, IteratorInputInfo
from nodes.properties.inputs import EnumInput
from nodes.properties.outputs import NumberOutput

from .. import math_group


class AnyNumberInput(BaseInput):
    def __init__(self, label: str):
        super().__init__(
            input_type="number",
            label=label,
            kind="generic",
            has_handle=True,
            associated_type=float,
        )


class Operation(Enum):
    SUM = "sum"
    PRODUCT = "prod"
    MAXIMUM = "max"
    MINIMUM = "min"

    @property
    def neutral(self) -> float:
        if self == Operation.SUM:
            return 0
        elif self == Operation.PRODUCT:
            return 1
        elif self == Operation.MAXIMUM:
            return float("-inf")
        elif self == Operation.MINIMUM:
            return float("inf")
        else:
            raise NotImplementedError()

    def reduce(self, a: float, b: float) -> float:
        if self == Operation.SUM:
            return a + b
        elif self == Operation.PRODUCT:
            return a * b
        elif self == Operation.MAXIMUM:
            return max(a, b)
        elif self == Operation.MINIMUM:
            return min(a, b)
        else:
            raise NotImplementedError()


@math_group.register(
    schema_id="chainner:utility:accumulate",
    name="Accumulate",
    description="Calculates a single number of a sequence of number.",
    icon="MdCalculate",
    inputs=[
        AnyNumberInput("Numbers"),
        EnumInput(Operation),
    ],
    iterator_inputs=IteratorInputInfo(inputs=0),
    outputs=[
        NumberOutput(
            "Result",
            output_type="""
                let x = Input0;
                let op = Input1;
                let length = int(0..); // TODO: iterator sequence length

                let neutral = match op {
                    Operation::Sum     => 0,
                    Operation::Product => 1,
                    Operation::Maximum => -inf,
                    Operation::Minimum => inf,
                };

                match length {
                    0 => neutral,
                    uint => match op {
                        Operation::Sum     => x * length,
                        Operation::Product => number::pow(x, length),
                        Operation::Maximum => x,
                        Operation::Minimum => x,
                    }
                }
                """,
        )
    ],
    kind="collector",
)
def accumulate_node(_: None, operation: Operation) -> Collector[float, float]:
    result = [operation.neutral]

    def on_iterate(x: float):
        result[0] = operation.reduce(result[0], x)

    def on_complete():
        return result[0]

    return Collector(on_iterate=on_iterate, on_complete=on_complete)
