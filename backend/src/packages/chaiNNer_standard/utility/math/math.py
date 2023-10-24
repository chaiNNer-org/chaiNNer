from __future__ import annotations

import math
from enum import Enum
from typing import Dict, Union

from nodes.properties.inputs import EnumInput, NumberInput
from nodes.properties.outputs import NumberOutput

from .. import math_group


class MathOperation(Enum):
    ADD = "add"
    SUBTRACT = "sub"
    MULTIPLY = "mul"
    DIVIDE = "div"
    POWER = "pow"
    LOG = "log"
    MAXIMUM = "max"
    MINIMUM = "min"
    MODULO = "mod"
    PERCENT = "percent"


OP_LABEL: Dict[MathOperation, str] = {
    MathOperation.ADD: "Add: a + b",
    MathOperation.SUBTRACT: "Subtract: a - b",
    MathOperation.MULTIPLY: "Multiply: a × b",
    MathOperation.DIVIDE: "Divide: a ÷ b",
    MathOperation.POWER: "Exponent: a ^ b",
    MathOperation.LOG: "Logarithm: log a of b",
    MathOperation.MAXIMUM: "Maximum: max(a, b)",
    MathOperation.MINIMUM: "Minimum: min(a, b)",
    MathOperation.MODULO: "Modulo: a mod b",
    MathOperation.PERCENT: "Percent: a × b ÷ 100",
}

_special_mod_numbers = (0.0, float("inf"), float("-inf"), float("nan"))


@math_group.register(
    schema_id="chainner:utility:math",
    name="Math",
    description="Perform mathematical operations on numbers.",
    see_also=[
        "chainner:utility:math_round",
        "chainner:utility:number",
    ],
    icon="MdCalculate",
    inputs=[
        NumberInput(
            "Operand a",
            minimum=None,
            maximum=None,
            precision=100,
            controls_step=1,
        ),
        EnumInput(MathOperation, "Math Operation", option_labels=OP_LABEL),
        NumberInput(
            "Operand b",
            minimum=None,
            maximum=None,
            precision=100,
            controls_step=1,
        ),
    ],
    outputs=[
        NumberOutput(
            "Result",
            output_type="""
                let a = Input0;
                let b = Input2;

                def nonZero(x: number): number {
                    match x {
                        0 => never,
                        _ as x => x,
                    }
                }

                match Input1 {
                    MathOperation::Add      => a + b,
                    MathOperation::Subtract => a - b,
                    MathOperation::Multiply => a * b,
                    MathOperation::Divide   => a / nonZero(b),
                    MathOperation::Power    => number::pow(a, b),
                    MathOperation::Log      => number::log(a) / number::log(b),
                    MathOperation::Maximum  => max(a, b),
                    MathOperation::Minimum  => min(a, b),
                    MathOperation::Modulo   => number::mod(a, b),
                    MathOperation::Percent  => a * b / 100,
                }
                """,
        ).with_never_reason(
            "The mathematical operation is not defined. This is most likely a divide by zero error."
        )
    ],
)
def math_node(a: float, op: MathOperation, b: float) -> Union[int, float]:
    if op == MathOperation.ADD:
        return a + b
    elif op == MathOperation.SUBTRACT:
        return a - b
    elif op == MathOperation.MULTIPLY:
        return a * b
    elif op == MathOperation.DIVIDE:
        return a / b
    elif op == MathOperation.POWER:
        try:
            result = pow(a, b)
        except Exception as e:
            raise ValueError(f"{a}^{b} is not defined for real numbers.") from e

        if isinstance(result, (int, float)):
            return result
        raise ValueError(f"{a}^{b} is not defined for real numbers.")
    elif op == MathOperation.LOG:
        return math.log(b, a)
    elif op == MathOperation.MAXIMUM:
        return max(a, b)
    elif op == MathOperation.MINIMUM:
        return min(a, b)
    elif op == MathOperation.MODULO:
        if a in _special_mod_numbers or b in _special_mod_numbers:
            return a - b * math.floor(a / b)
        else:
            return a % b
    elif op == MathOperation.PERCENT:
        return a * b / 100
    else:
        raise RuntimeError(f"Unknown operator {op}")
