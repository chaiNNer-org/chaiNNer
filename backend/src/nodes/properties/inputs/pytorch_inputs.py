try:
    import torch
except:
    torch = None

from .base_input import BaseInput


class StateDictInput(BaseInput):
    """Input a PyTorch state dict"""

    def __init__(self):
        super().__init__(f"pytorch::state_dict", "State Dict")


class ModelInput(BaseInput):
    """Input a loaded model"""

    def __init__(self, label: str = "Model"):
        super().__init__(f"pytorch::model", label)

    def enforce(self, value):
        if torch is not None:
            assert isinstance(value, torch.nn.Module), "Expected a PyTorch model"
        return value


class TorchScriptInput(BaseInput):
    """Input a JIT traced model"""

    def __init__(self, label: str = "Traced Model"):
        super().__init__(f"pytorch::torchscript", label)
