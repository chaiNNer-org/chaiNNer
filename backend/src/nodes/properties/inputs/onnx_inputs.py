import navi
from api import BaseInput

from ...impl.onnx.model import OnnxGeneric, OnnxModel, OnnxModels, OnnxRemBg
from .generic_inputs import DropDownInput


class OnnxModelInput(BaseInput):
    """Input for onnx model"""

    def __init__(
        self, label: str = "Model", input_type: navi.ExpressionJson = "OnnxModel"
    ):
        super().__init__(input_type, label)
        self.associated_type = OnnxModel


class OnnxGenericModelInput(OnnxModelInput):
    """ONNX model input for things that aren't background removal"""

    def __init__(
        self, label: str = "Model", input_type: navi.ExpressionJson = "OnnxModel"
    ):
        super().__init__(label, navi.intersect(input_type, "OnnxGenericModel"))
        self.associated_type = OnnxGeneric

    def enforce(self, value: object):
        assert isinstance(value, OnnxModels)
        assert value.sub_type == "Generic", "Expected a non-rembg model"
        return value


class OnnxRemBgModelInput(OnnxModelInput):
    """ONNX model input for background removal"""

    def __init__(
        self, label: str = "Model", input_type: navi.ExpressionJson = "OnnxModel"
    ):
        super().__init__(label, navi.intersect(input_type, "OnnxRemBgModel"))
        self.associated_type = OnnxRemBg

    def enforce(self, value: object):
        assert isinstance(value, OnnxModels)
        assert value.sub_type == "RemBg", "Expected a rembg model"
        return value


def OnnxFpDropdown() -> DropDownInput:
    return DropDownInput(
        input_type="FpMode",
        label="Data Type",
        options=[
            {
                "option": "fp32",
                "value": 0,
                "type": "FpMode::fp32",
            },
            {
                "option": "fp16",
                "value": 1,
                "type": "FpMode::fp16",
            },
        ],
    )
