try:
    import torch
except:
    torch = None

from typing import Union


from ..expression import ExpressionJson
from .base_input import BaseInput


class ModelInput(BaseInput):
    """Input a loaded model"""

    def __init__(
        self,
        label: str = "Model",
        input_type: Union[str, ExpressionJson] = "PyTorchModel",
    ):
        super().__init__(input_type, label)

    def enforce(self, value):
        if torch is not None:
            assert isinstance(value, torch.nn.Module), "Expected a PyTorch model"
        return value


class TorchScriptInput(BaseInput):
    """Input a JIT traced model"""

    def __init__(self, label: str = "Traced Model"):
        super().__init__("PyTorchScript", label)
