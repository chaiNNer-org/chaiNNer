from __future__ import annotations

try:
    import spandrel
    from spandrel import Purpose
except Exception:
    spandrel = None

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
        if spandrel is not None:
            self.associated_type = spandrel.ModelDescriptor

    def enforce(self, value: object):
        if spandrel is not None:
            assert isinstance(
                value,
                (spandrel.ImageModelDescriptor, spandrel.MaskedImageModelDescriptor),
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
        if spandrel is not None:
            self.associated_type = spandrel.ImageModelDescriptor

    def enforce(self, value: object):
        if spandrel is not None:
            assert isinstance(
                value, spandrel.ImageModelDescriptor
            ), "Expected a supported single image PyTorch model."
            assert (
                value.purpose in self.purpose
            ), "Expected a Super-Resolution or Restoration model."
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
        if spandrel is not None:
            self.associated_type = spandrel.ImageModelDescriptor

    def enforce(self, value: object):
        if spandrel is not None:
            assert isinstance(
                value, spandrel.ImageModelDescriptor
            ), "Expected a supported single image PyTorch model."
            assert (
                value.purpose in self.purpose
            ), "Expected a Face Super-Resolution model."
        return value


class InpaintModelInput(ModelInput):
    def __init__(
        self, label: str = "Model", input_type: navi.ExpressionJson = "PyTorchModel"
    ):
        self.purpose: set[Purpose] = {"Inpainting"}

        super().__init__(
            label,
            navi.intersect(input_type, _model_with_purpose(self.purpose)),
        )
        if spandrel is not None:
            self.associated_type = spandrel.MaskedImageModelDescriptor

    def enforce(self, value: object):
        if spandrel is not None:
            assert isinstance(
                value, spandrel.MaskedImageModelDescriptor
            ), "Expected a supported masked-image PyTorch model."
            assert value.purpose in self.purpose, "Expected an Inpainting model."
        return value


class TorchScriptInput(BaseInput):
    """Input a JIT traced model"""

    def __init__(self, label: str = "Traced Model"):
        super().__init__("PyTorchScript", label)
