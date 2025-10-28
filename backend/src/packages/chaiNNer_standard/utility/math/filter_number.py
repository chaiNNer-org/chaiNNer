from __future__ import annotations

from enum import Enum

from api import IteratorInputInfo, IteratorOutputInfo, Transformer
from nodes.properties.inputs import EnumInput, NumberInput
from nodes.properties.outputs import NumberOutput

from .. import math_group


class AnyNumberInput:
    def __init__(self, label: str):
        from api import BaseInput

        self.base = BaseInput(
            input_type="number",
            label=label,
            kind="generic",
            has_handle=True,
            associated_type=float,
        )


class AnyNumberOutput:
    def __init__(self, label: str):
        from api import BaseOutput

        self.base = BaseOutput(
            output_type="number",
            label=label,
            kind="generic",
            has_handle=True,
            associated_type=float,
        )


class FilterCondition(Enum):
    GREATER_THAN = ">"
    LESS_THAN = "<"
    EQUAL = "=="
    NOT_EQUAL = "!="
    GREATER_OR_EQUAL = ">="
    LESS_OR_EQUAL = "<="


@math_group.register(
    schema_id="chainner:utility:filter_number",
    name="Filter Number",
    description="Filters numbers in an iterator sequence based on a condition. Only numbers that satisfy the condition will pass through.",
    icon="MdFilterList",
    inputs=[
        AnyNumberInput("Number").base,
        EnumInput(FilterCondition, default=FilterCondition.GREATER_THAN),
        NumberInput("Threshold", default=0, min=None, max=None),
    ],
    outputs=[
        AnyNumberOutput("Number").base,
    ],
    iterator_inputs=IteratorInputInfo(inputs=0),
    iterator_outputs=IteratorOutputInfo(outputs=0),
    kind="transformer",
)
def filter_number_node(
    _: None, condition: FilterCondition, threshold: float
) -> Transformer:
    def transform(value: float) -> list[float]:
        passes = False
        if condition == FilterCondition.GREATER_THAN:
            passes = value > threshold
        elif condition == FilterCondition.LESS_THAN:
            passes = value < threshold
        elif condition == FilterCondition.EQUAL:
            passes = value == threshold
        elif condition == FilterCondition.NOT_EQUAL:
            passes = value != threshold
        elif condition == FilterCondition.GREATER_OR_EQUAL:
            passes = value >= threshold
        elif condition == FilterCondition.LESS_OR_EQUAL:
            passes = value <= threshold

        if passes:
            return [value]
        return []

    return Transformer(transform=transform)
