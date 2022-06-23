from .base_input import BaseInput


class OnnxModelInput(BaseInput):
    """Input for onnx model"""

    def __init__(self, label: str = "Model"):
        super().__init__("OnnxModel", label=label)
