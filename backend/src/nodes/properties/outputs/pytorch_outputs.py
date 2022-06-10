from .base_output import BaseOutput


def ModelOutput():
    """Output a loaded model"""
    return BaseOutput("PyTorchModel", "Model")


def TorchScriptOutput():
    """Output a JIT traced model"""
    return BaseOutput("PyTorchScript", "Traced Model")
