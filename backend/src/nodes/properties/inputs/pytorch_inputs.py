try:
    import torch

    from ...impl.pytorch.types import (
        is_pytorch_face_model,
        is_pytorch_inpaint_model,
        is_pytorch_model,
        is_pytorch_sr_model,
    )
except:
    torch = None

from ..expression import ExpressionJson, intersect
from .base_input import BaseInput


class ModelInput(BaseInput):
    """Input a loaded model"""

    def __init__(
        self,
        label: str = "Model",
        input_type: ExpressionJson = "PyTorchModel",
    ):
        super().__init__(input_type, label)

    def enforce(self, value):
        if torch is not None:
            assert isinstance(value, torch.nn.Module), "Expected a PyTorch model."
            assert is_pytorch_model(value), "Expected a supported PyTorch model."
        return value


class SrModelInput(ModelInput):
    def __init__(
        self,
        label: str = "Model",
        input_type: ExpressionJson = "PyTorchModel",
    ):
        super().__init__(
            label,
            intersect(input_type, "PyTorchSRModel"),
        )

    def enforce(self, value):
        if torch is not None:
            assert isinstance(value, torch.nn.Module), "Expected a PyTorch model."
            assert is_pytorch_sr_model(
                value
            ), "Expected a regular Super-Resolution model."
        return value


class FaceModelInput(ModelInput):
    def __init__(
        self, label: str = "Model", input_type: ExpressionJson = "PyTorchModel"
    ):
        super().__init__(
            label,
            intersect(input_type, "PyTorchFaceModel"),
        )

    def enforce(self, value):
        if torch is not None:
            assert isinstance(value, torch.nn.Module), "Expected a PyTorch model."
            assert is_pytorch_face_model(
                value
            ), "Expected a Face-specific Super-Resolution model."
        return value


class InpaintModelInput(ModelInput):
    def __init__(
        self, label: str = "Model", input_type: ExpressionJson = "PyTorchModel"
    ):
        super().__init__(
            label,
            intersect(input_type, "PyTorchInpaintModel"),
        )

    def enforce(self, value):
        if torch is not None:
            assert isinstance(value, torch.nn.Module), "Expected a PyTorch model."
            assert is_pytorch_inpaint_model(
                value
            ), "Expected an inpainting-specific model."
        return value


class TorchScriptInput(BaseInput):
    """Input a JIT traced model"""

    def __init__(self, label: str = "Traced Model"):
        super().__init__("PyTorchScript", label)
