from ...impl.onnx.model import OnnxModel
from ...properties import expression
from .base_output import BaseOutput, OutputKind


class OnnxModelOutput(BaseOutput):
    """Output for onnx model"""

    def __init__(
        self,
        model_type: expression.ExpressionJson = "OnnxModel",
        label: str = "Model",
        kind: OutputKind = "generic",
        should_broadcast: bool = False,
    ):
        super().__init__(model_type, label, kind=kind)
        self.should_broadcast = should_broadcast

    def get_broadcast_data(self, value: OnnxModel):
        if not self.should_broadcast:
            return None

        return {
            "arch": value.arch,
            "subType": value.sub_type,
        }
