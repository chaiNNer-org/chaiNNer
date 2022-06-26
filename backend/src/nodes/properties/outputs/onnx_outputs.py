from .base_output import BaseOutput


def OnnxModelOutput(label: str = "Model"):
    """Output for onnx model"""
    return BaseOutput("OnnxModel", label)
