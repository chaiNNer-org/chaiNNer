from __future__ import annotations

try:
    import torch
    from spandrel import (
        ImageModelDescriptor,
        MaskedImageModelDescriptor,
        ModelDescriptor,
        Purpose,
    )
except Exception:
    torch = None
    ImageModelDescriptor = object
    MaskedImageModelDescriptor = object

import navi
from api import BaseInput


def _model_with_purpose(purpose: set[Purpose]):
    sub_type = " | ".join('"' + p + '"' for p in purpose)
    return "PyTorchModel { subType: " + sub_type + " }"


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
                value, (ImageModelDescriptor, MaskedImageModelDescriptor)
            ), "Expected a supported PyTorch model."
        return value


class SrModelInput(ModelInput):
    def __init__(
        self,
        label: str = "Model",
        input_type: navi.ExpressionJson = "PyTorchModel",
    ):
        self.purpose: set[Purpose] = {"SR", "Restoration"}

        super().__init__(
            label,
            navi.intersect(input_type, _model_with_purpose(self.purpose)),
        )
        if torch is not None:
            self.associated_type = ImageModelDescriptor

    def enforce(self, value: ModelDescriptor):
        if torch is not None:
            assert (
                value.purpose in self.purpose
            ), "Expected a Super-Resolution or Restoration model."
            assert isinstance(
                value, ImageModelDescriptor
            ), "Expected a supported single image PyTorch model."
        return value


class FaceModelInput(ModelInput):
    def __init__(
        self, label: str = "Model", input_type: navi.ExpressionJson = "PyTorchModel"
    ):
        self.purpose: set[Purpose] = {"FaceSR"}

        super().__init__(
            label,
            navi.intersect(input_type, _model_with_purpose(self.purpose)),
        )
        if torch is not None:
            self.associated_type = ImageModelDescriptor

    def enforce(self, value: ModelDescriptor):
        if torch is not None:
            assert (
                value.purpose in self.purpose
            ), "Expected a Face Super-Resolution model."
            assert isinstance(
                value, ImageModelDescriptor
            ), "Expected a supported single image PyTorch model."
        return value


class InpaintModelInput(ModelInput):
    def __init__(
        self, label: str = "Model", input_type: navi.ExpressionJson = "PyTorchModel"
    ):
        self.purpose: set[Purpose] = {"Inpaint"}

        super().__init__(
            label,
            navi.intersect(input_type, _model_with_purpose(self.purpose)),
        )
        if torch is not None:
            self.associated_type = MaskedImageModelDescriptor

    def enforce(self, value: ModelDescriptor):
        if torch is not None:
            assert value.purpose in self.purpose, "Expected an Inpainting model."
            assert isinstance(
                value, MaskedImageModelDescriptor
            ), "Expected a supported masked-image PyTorch model."
        return value


class TorchScriptInput(BaseInput):
    """Input a JIT traced model"""

    def __init__(self, label: str = "Traced Model"):
        super().__init__("PyTorchScript", label)
