import navi

from ...impl.onnx.model import OnnxModel, OnnxModels, OnnxRemBg, is_rembg_model
from .base_input import BaseInput
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

    def enforce(self, value):
        assert isinstance(value, OnnxModels)
        assert not is_rembg_model(value.bytes), "Expected a non-rembg model"
        return value


class OnnxRemBgModelInput(OnnxModelInput):
    """ONNX model input for background removal"""

    def __init__(
        self, label: str = "Model", input_type: navi.ExpressionJson = "OnnxModel"
    ):
        super().__init__(label, navi.intersect(input_type, "OnnxRemBgModel"))
        self.associated_type = OnnxRemBg

    def enforce(self, value):
        assert isinstance(value, OnnxModels)
        assert is_rembg_model(value.bytes), "Expected a rembg model"
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
