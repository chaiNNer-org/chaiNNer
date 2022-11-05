try:
    import torch
    from ...utils.torch_types import (
        isPyTorchSRModel,
        isPyTorchFaceModel,
        isPyTorchModel,
    )
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
            assert isinstance(value, torch.nn.Module), "Expected a PyTorch model."
            assert isPyTorchModel(value), "Expected a supported PyTorch model."
        return value


class SrModelInput(ModelInput):
    def __init__(
        self,
        label: str = "Model",
        input_type: Union[
            str, ExpressionJson
        ] = "PyTorchModel { arch: invStrSet(PyTorchModel::FaceArchs) }",
    ):
        super().__init__(label, input_type)

    def enforce(self, value):
        if torch is not None:
            assert isinstance(value, torch.nn.Module), "Expected a PyTorch model."
            assert isPyTorchSRModel(value), "Expected a regular Super-Resolution model."
        return value


class FaceModelInput(ModelInput):
    def __init__(
        self,
        label: str = "Face SR Model",
        input_type: Union[
            str, ExpressionJson
        ] = "PyTorchModel { arch: PyTorchModel::FaceArchs }",
    ):
        super().__init__(label, input_type)

    def enforce(self, value):
        if torch is not None:
            assert isinstance(value, torch.nn.Module), "Expected a PyTorch model."
            assert isPyTorchFaceModel(
                value
            ), "Expected a Face-specific Super-Resolution model."
        return value


class TorchScriptInput(BaseInput):
    """Input a JIT traced model"""

    def __init__(self, label: str = "Traced Model"):
        super().__init__("PyTorchScript", label)
