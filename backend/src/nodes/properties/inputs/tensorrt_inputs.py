import navi
from api import BaseInput

from ...impl.tensorrt.model import TensorRTEngine
from .generic_inputs import DropDownInput


class TensorRTEngineInput(BaseInput):
    """Input for TensorRT engine."""

    def __init__(
        self,
        label: str = "TensorRT Engine",
        input_type: navi.ExpressionJson = "TensorRTEngine",
    ):
        super().__init__(input_type, label)
        self.associated_type = TensorRTEngine


def TensorRTPrecisionDropdown() -> DropDownInput:
    """Dropdown for selecting TensorRT precision mode."""
    return DropDownInput(
        input_type="TrtPrecision",
        label="Precision",
        options=[
            {
                "option": "FP32",
                "value": "fp32",
                "type": "TrtPrecision::fp32",
            },
            {
                "option": "FP16",
                "value": "fp16",
                "type": "TrtPrecision::fp16",
            },
        ],
    )


def TensorRTShapeModeDropdown() -> DropDownInput:
    """Dropdown for selecting TensorRT shape mode."""
    return DropDownInput(
        input_type="TrtShapeMode",
        label="Shape Mode",
        options=[
            {
                "option": "Fixed",
                "value": "fixed",
                "type": "TrtShapeMode::fixed",
            },
            {
                "option": "Dynamic",
                "value": "dynamic",
                "type": "TrtShapeMode::dynamic",
            },
        ],
    )
