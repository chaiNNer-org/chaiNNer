from .base_output import BaseOutput
from .. import expression


def NumberOutput(label: str, output_type: expression.ExpressionJson = "number"):
    """Output for arbitrary number"""
    return BaseOutput(expression.intersect("number", output_type), label)


def TextOutput(label: str, output_type: expression.ExpressionJson = "string"):
    """Output for arbitrary text"""
    return BaseOutput(expression.intersect("string", output_type), label)
