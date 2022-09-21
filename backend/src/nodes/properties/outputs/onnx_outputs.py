from ...utils.onnx_model import OnnxModel
from .. import expression
from .base_output import BaseOutput, OutputKind


class OnnxModelOutput(BaseOutput):
    def __init__(
        self,
        model_type: expression.ExpressionJson = "OnnxModel",
        label: str = "Model",
        kind: OutputKind = "onnx",
        should_broadcast=False,
    ):
        super().__init__(model_type, label, kind=kind)
        self.should_broadcast = should_broadcast

    def get_broadcast_data(self, value: OnnxModel):
        if not self.should_broadcast:
            return None

        return {
            "inNc": value.in_nc,
            "outNc": value.out_nc,
            "scale": value.scale,
            "nf": value.nf,
        }
