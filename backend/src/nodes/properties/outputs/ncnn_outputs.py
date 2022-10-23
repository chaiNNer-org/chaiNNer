from ...utils.ncnn_model import NcnnModelWrapper
from .. import expression
from .base_output import BaseOutput, OutputKind


class NcnnModelOutput(BaseOutput):
    def __init__(
        self,
        model_type: expression.ExpressionJson = "NcnnNetwork",
        label: str = "Model",
        kind: OutputKind = "generic",
        should_broadcast=False,
    ):
        super().__init__(model_type, label, kind=kind)
        self.should_broadcast = should_broadcast

    def get_broadcast_data(self, value: NcnnModelWrapper):
        if not self.should_broadcast:
            return None

        return {
            "inNc": value.in_nc,
            "outNc": value.out_nc,
            "scale": value.scale,
            "nf": value.nf,
            "fp": value.fp,
        }
