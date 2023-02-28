from __future__ import annotations

import math
from enum import Enum
from typing import Union

from ...groups import conditional_group
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import EnumInput, NumberInput
from ...properties.outputs import NumberOutput
from . import category as UtilityCategory


class RoundOperation(Enum):
    FLOOR = "Down"
    CEILING = "Up"
    ROUND = "Either way"


class RoundScale(Enum):
    UNIT = "Whole Number"
    MULTIPLE = "Multiple of..."
    POWER = "Power of..."


@NodeFactory.register("chainner:utility:math_round")
class RoundNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Round an input number"
        self.inputs = [
            NumberInput(
                "Input",
                minimum=None,
                maximum=None,
                precision=100,
                controls_step=1,
            ),
            EnumInput(
                RoundOperation,
                "Round",
                option_labels={k: k.value for k in RoundOperation},
            ),
            EnumInput(
                RoundScale,
                "to the nearest",
                option_labels={k: k.value for k in RoundScale},
            ),
            conditional_group(enum=2, condition=RoundScale.MULTIPLE.value)(
                NumberInput(
                    "Multiple",
                    default=1,
                    minimum=1e-100,
                    maximum=None,
                    precision=100,
                    controls_step=1,
                )
            ),
            conditional_group(enum=2, condition=RoundScale.POWER.value)(
                NumberInput(
                    "Power",
                    default=2,
                    minimum=(1 + 1e-100),
                    maximum=None,
                    precision=100,
                    controls_step=1,
                )
            ),
        ]
        self.outputs = [
            NumberOutput(
                "Result",
                output_type="""
                let x = Input0;
                let m = Input3;
                let p = Input4;

                match Input2 {
                    RoundScale::Unit => match Input1 {
                        RoundOperation::Floor => floor(x),
                        RoundOperation::Ceiling => ceil(x),
                        RoundOperation::Round => round(x),
                    },
                    RoundScale::Multiple => match Input1 {
                        RoundOperation::Floor => floor(x/m) * m,
                        RoundOperation::Ceiling => ceil(x/m) * m,
                        RoundOperation::Round => round(x/m) * m,
                    },
                    RoundScale::Power => match Input1 {
                        RoundOperation::Floor => number::pow(p, floor(number::log(x)/number::log(p))),
                        RoundOperation::Ceiling => number::pow(p, ceil(number::log(x)/number::log(p))),
                        RoundOperation::Round => number::pow(p, round(number::log(x)/number::log(p))),
                    },
                }
                """,
            )
        ]

        self.category = UtilityCategory
        self.name = "Round"
        self.icon = "MdCalculate"
        self.sub = "Math"

    def run(
        self,
        a: Union[int, float],
        operation: RoundOperation,
        scale: RoundScale,
        m: Union[int, float],
        p: Union[int, float],
    ) -> Union[int, float]:
        if operation == RoundOperation.FLOOR:
            op = math.floor
        elif operation == RoundOperation.CEILING:
            op = math.ceil
        elif operation == RoundOperation.ROUND:
            op = round
        else:
            raise RuntimeError(f"Unknown operation {operation}")

        if scale == RoundScale.UNIT:
            return op(a)
        elif scale == RoundScale.MULTIPLE:
            return op(a / m) * m
        elif scale == RoundScale.POWER:
            return p ** op(math.log(a, p))
        else:
            raise RuntimeError(f"Unknown scale {scale}")
