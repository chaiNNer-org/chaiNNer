from __future__ import annotations

try:
    import spandrel
except Exception:
    spandrel = None

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
        super().__init__(
            label,
            navi.intersect(
                input_type,
                """PyTorchModel { subType: "SR" | "Restoration" }""",
            ),
        )
        if spandrel is not None:
            self.associated_type = spandrel.ImageModelDescriptor

    def enforce(self, value: object):
        if spandrel is not None:
            assert isinstance(
                value, spandrel.ImageModelDescriptor
            ), "Expected a supported single image PyTorch model."
            assert value.purpose in (
                "SR",
                "Restoration",
            ), "Expected a Super-Resolution or Restoration model."
        return value


class FaceModelInput(ModelInput):
    def __init__(
        self, label: str = "Model", input_type: navi.ExpressionJson = "PyTorchModel"
    ):
        super().__init__(
            label,
            navi.intersect(
                input_type,
                """PyTorchModel { subType: "FaceSR" }""",
            ),
        )
        if spandrel is not None:
            self.associated_type = spandrel.ImageModelDescriptor

    def enforce(self, value: object):
        if spandrel is not None:
            assert isinstance(
                value, spandrel.ImageModelDescriptor
            ), "Expected a supported single image PyTorch model."
            assert value.purpose in (
                "FaceSR"
            ), "Expected a Face Super-Resolution model."
        return value


class InpaintModelInput(ModelInput):
    def __init__(
        self, label: str = "Model", input_type: navi.ExpressionJson = "PyTorchModel"
    ):
        super().__init__(
            label,
            navi.intersect(
                input_type,
                """PyTorchModel { subType: "Inpaint" }""",
            ),
        )
        if spandrel is not None:
            self.associated_type = spandrel.MaskedImageModelDescriptor

    def enforce(self, value: object):
        if spandrel is not None:
            assert isinstance(
                value, spandrel.MaskedImageModelDescriptor
            ), "Expected a supported masked-image PyTorch model."
            assert value.purpose in (
                "Inpaint"
            ), "Expected a Face Super-Resolution model."
        return value


class TorchScriptInput(BaseInput):
    """Input a JIT traced model"""

    def __init__(self, label: str = "Traced Model"):
        super().__init__("PyTorchScript", label)
