try:
    import torch
    from spandrel import (
        FaceSRModelDescriptor,
        InpaintModelDescriptor,
        ModelDescriptor,
        SRModelDescriptor,
    )
except Exception:
    torch = None
    ModelDescriptor = object
    SRModelDescriptor = object
    FaceSRModelDescriptor = object
    InpaintModelDescriptor = object

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
            self.associated_type = ModelDescriptor

    def enforce(self, value: object):
        if torch is not None:
            assert isinstance(
                value, ModelDescriptor
            ), "Expected a supported PyTorch model."
            assert isinstance(value.model, torch.nn.Module), "Expected a PyTorch model."  # type: ignore
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
            self.associated_type = SRModelDescriptor

    def enforce(self, value: object):
        if torch is not None:
            assert isinstance(
                value, SRModelDescriptor
            ), "Expected a regular Super-Resolution model."
            assert isinstance(value.model, torch.nn.Module), "Expected a PyTorch model."  # type: ignore
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
            self.associated_type = FaceSRModelDescriptor

    def enforce(self, value: object):
        if torch is not None:
            assert isinstance(
                value, FaceSRModelDescriptor
            ), "Expected a Face-specific Super-Resolution model."
            assert isinstance(value.model, torch.nn.Module), "Expected a PyTorch model."  # type: ignore
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
            self.associated_type = InpaintModelDescriptor

    def enforce(self, value: object):
        if torch is not None:
            assert isinstance(
                value, InpaintModelDescriptor
            ), "Expected an inpainting-specific model."
            assert isinstance(value.model, torch.nn.Module), "Expected a PyTorch model."  # type: ignore
        return value


class TorchScriptInput(BaseInput):
    """Input a JIT traced model"""

    def __init__(self, label: str = "Traced Model"):
        super().__init__("PyTorchScript", label)
