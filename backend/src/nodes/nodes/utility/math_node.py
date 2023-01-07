from __future__ import annotations
from enum import Enum
import math
from typing import Dict, Union

from . import category as UtilityCategory

from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import NumberInput, EnumInput
from ...properties.outputs import NumberOutput


class MathOperation(Enum):
    ADD = "add"
    SUBTRACT = "sub"
    MULTIPLY = "mul"
    DIVIDE = "div"
    POWER = "pow"
    MAXIMUM = "max"
    MINIMUM = "min"
    MODULO = "mod"


OP_LABEL: Dict[MathOperation, str] = {
    MathOperation.ADD: "Add: a + b",
    MathOperation.SUBTRACT: "Subtract: a - b",
    MathOperation.MULTIPLY: "Multiply: a × b",
    MathOperation.DIVIDE: "Divide: a ÷ b",
    MathOperation.POWER: "Exponent: a ^ b",
    MathOperation.MAXIMUM: "Maximum: max(a, b)",
    MathOperation.MINIMUM: "Minimum: min(a, b)",
    MathOperation.MODULO: "Modulo: a mod b",
}

_special_mod_numbers = (0.0, float("inf"), float("-inf"), float("nan"))


@NodeFactory.register("chainner:utility:math")
class MathNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Perform mathematical operations on numbers."
        self.inputs = [
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
        ]
        self.outputs = [
            NumberOutput(
                "Result",
                output_type="""
                let a = Input0;
                let b = Input2;

                match Input1 {
                    MathOperation::Add      => a + b,
                    MathOperation::Subtract => a - b,
                    MathOperation::Multiply => a * b,
                    MathOperation::Divide   => a / b,
                    MathOperation::Power    => pow(a, b),
                    MathOperation::Maximum  => max(a, b),
                    MathOperation::Minimum  => min(a, b),
                    MathOperation::Modulo   => mod(a, b),
                }
                """,
            )
        ]

        self.category = UtilityCategory
        self.name = "Math"
        self.icon = "MdCalculate"
        self.sub = "Math"

    def run(
        self, a: Union[int, float], op: MathOperation, b: Union[int, float]
    ) -> Union[int, float]:
        if op == MathOperation.ADD:
            return a + b
        elif op == MathOperation.SUBTRACT:
            return a - b
        elif op == MathOperation.MULTIPLY:
            return a * b
        elif op == MathOperation.DIVIDE:
            return a / b
        elif op == MathOperation.POWER:
            return a**b
        elif op == MathOperation.MAXIMUM:
            return max(a, b)
        elif op == MathOperation.MINIMUM:
            return min(a, b)
        elif op == MathOperation.MODULO:
            if a in _special_mod_numbers or b in _special_mod_numbers:
                return a - b * math.floor(a / b)
            else:
                return a % b
        else:
            raise RuntimeError(f"Unknown operator {op}")
