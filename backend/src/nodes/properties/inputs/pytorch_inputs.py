try:
    import torch

    from ...impl.pytorch.types import (
        PyTorchFaceModel,
        PyTorchInpaintModel,
        PyTorchModel,
        PyTorchSRModel,
        is_pytorch_face_model,
        is_pytorch_inpaint_model,
        is_pytorch_model,
        is_pytorch_sr_model,
    )
except:
    torch = None

import navi
from api import BaseInput


class ModelInput(BaseInput):
    """Input a loaded model"""

    def __init__(
        self,
        label: str = "Model",
        input_type: navi.ExpressionJson = "PyTorchModel",
    ):
        super().__init__(input_type, label)
        if torch is not None:
            self.associated_type = PyTorchModel

    def enforce(self, value):
        if torch is not None:
            assert isinstance(value, torch.nn.Module), "Expected a PyTorch model."
            assert is_pytorch_model(value), "Expected a supported PyTorch model."
        return value


class SrModelInput(ModelInput):
    def __init__(
        self,
        label: str = "Model",
        input_type: navi.ExpressionJson = "PyTorchModel",
    ):
        super().__init__(
            label,
            navi.intersect(input_type, "PyTorchSRModel"),
        )
        if torch is not None:
            self.associated_type = PyTorchSRModel

    def enforce(self, value):
        if torch is not None:
            assert isinstance(value, torch.nn.Module), "Expected a PyTorch model."
            assert is_pytorch_sr_model(
                value
            ), "Expected a regular Super-Resolution model."
        return value


class FaceModelInput(ModelInput):
    def __init__(
        self, label: str = "Model", input_type: navi.ExpressionJson = "PyTorchModel"
    ):
        super().__init__(
            label,
            navi.intersect(input_type, "PyTorchFaceModel"),
        )
        if torch is not None:
            self.associated_type = PyTorchFaceModel

    def enforce(self, value):
        if torch is not None:
            assert isinstance(value, torch.nn.Module), "Expected a PyTorch model."
            assert is_pytorch_face_model(
                value
            ), "Expected a Face-specific Super-Resolution model."
        return value


class InpaintModelInput(ModelInput):
    def __init__(
        self, label: str = "Model", input_type: navi.ExpressionJson = "PyTorchModel"
    ):
        super().__init__(
            label,
            navi.intersect(input_type, "PyTorchInpaintModel"),
        )
        if torch is not None:
            self.associated_type = PyTorchInpaintModel

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
