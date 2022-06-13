from .base_output import BaseOutput
from .. import expression


def NumberOutput(label: str, output_type: expression.ExpressionJson = "number"):
    """Output for arbitrary number"""
    return BaseOutput(expression.intersect("number", output_type), label)


def TextOutput(label: str):
    """Output for arbitrary text"""
    return BaseOutput("string", label)
