from __future__ import annotations

from enum import Enum

from api import Lazy, SpecialSuggestion
from nodes.groups import if_enum_group
from nodes.properties.inputs import BoolInput, EnumInput
from nodes.properties.outputs import BoolOutput

from .. import math_group


class LogicOperation(Enum):
    AND = "and"
    OR = "or"
    XOR = "xor"
    NOT = "not"


OP_LABEL: dict[LogicOperation, str] = {
    LogicOperation.AND: "AND: a & b",
    LogicOperation.OR: "OR: a | b",
    LogicOperation.XOR: "XOR: a ^ b",
    LogicOperation.NOT: "NOT: !a",
}


@math_group.register(
    schema_id="chainner:utility:logic_operation",
    name="Logic Operation",
    description="Perform logic operations on conditions.",
    see_also=[
        "chainner:utility:conditional",
    ],
    icon="MdCalculate",
    inputs=[
        EnumInput(
            LogicOperation,
            "Logic Operation",
            option_labels=OP_LABEL,
            label_style="hidden",
        ).with_id(0),
        BoolInput("A", has_handle=True).with_id(1),
        if_enum_group(0, (LogicOperation.AND, LogicOperation.OR, LogicOperation.XOR))(
            BoolInput("B", default=False, has_handle=True).with_id(2).make_lazy(),
        ),
    ],
    outputs=[
        BoolOutput(
            label="Result",
            output_type="""
                let a = Input1;
                let b = Input2;

                match Input0 {
                    LogicOperation::And => a and b,
                    LogicOperation::Or  => a or b,
                    LogicOperation::Xor => a != b,
                    LogicOperation::Not => not a,
                }
            """,
        )
        .suggest()
        .as_passthrough_of(1),
    ],
    suggestions=[
        SpecialSuggestion(
            "AND",
            name="Logic Operation: AND",
            inputs={0: LogicOperation.AND},
        ),
        SpecialSuggestion(
            "&",
            name="Logic Operation: AND",
            inputs={0: LogicOperation.AND},
        ),
        SpecialSuggestion(
            "OR",
            name="Logic Operation: OR",
            inputs={0: LogicOperation.OR},
        ),
        SpecialSuggestion(
            "|",
            name="Logic Operation: OR",
            inputs={0: LogicOperation.OR},
        ),
        SpecialSuggestion(
            "XOR",
            name="Logic Operation: XOR",
            inputs={0: LogicOperation.XOR},
        ),
        SpecialSuggestion(
            "NOT",
            name="Logic Operation: NOT",
            inputs={0: LogicOperation.NOT},
        ),
        SpecialSuggestion(
            "!",
            name="Logic Operation: NOT",
            inputs={0: LogicOperation.NOT},
        ),
    ],
)
def logic_operation_node(op: LogicOperation, a: bool, b: Lazy[bool]) -> bool:
    if op == LogicOperation.AND:
        return a and b.value
    if op == LogicOperation.OR:
        return a or b.value
    if op == LogicOperation.XOR:
        return a != b.value
    if op == LogicOperation.NOT:
        return not a
