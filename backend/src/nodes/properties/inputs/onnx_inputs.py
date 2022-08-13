from .generic_inputs import DropDownInput
from .base_input import BaseInput


class OnnxModelInput(BaseInput):
    """Input for onnx model"""

    def __init__(self, label: str = "Model"):
        super().__init__("OnnxModel", label=label)


def OnnxFpDropdown() -> DropDownInput:
    return DropDownInput(
        input_type="FpMode",
        label="Data Type",
        options=[
            {"option": "fp32", "value": 0},
            {"option": "fp16", "value": 1},
        ],
    )
