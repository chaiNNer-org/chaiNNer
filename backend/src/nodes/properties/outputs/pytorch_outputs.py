from .. import expression
from .base_output import BaseOutput


def ModelOutput(model_type: expression.ExpressionJson = "PyTorchModel"):
    """Output a loaded model"""
    return BaseOutput(model_type, "Model")


def TorchScriptOutput():
    """Output a JIT traced model"""
    return BaseOutput("PyTorchScript", "Traced Model")
