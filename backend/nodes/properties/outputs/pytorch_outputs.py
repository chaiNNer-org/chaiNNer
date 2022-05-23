from .base_output import BaseOutput


class PyTorchOutput(BaseOutput):
    def __init__(self, pytorch_type: str, label: str):
        super().__init__(f"pytorch::{pytorch_type}", label)


def StateDictOutput():
    """Output a PyTorch state dict"""
    return PyTorchOutput("state_dict", "State Dict")


def ModelOutput():
    """Output a loaded model"""
    return PyTorchOutput("model", "Model")


def TorchScriptOutput():
    """Output a JIT traced model"""
    return PyTorchOutput("torchscript", "Traced Model")
