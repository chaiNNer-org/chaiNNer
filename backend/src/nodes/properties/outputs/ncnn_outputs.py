from ...impl.ncnn.model import NcnnModelWrapper
from .. import expression
from .base_output import BaseOutput, OutputKind


class NcnnModelOutput(BaseOutput):
    def __init__(
        self,
        model_type: expression.ExpressionJson = "NcnnNetwork",
        label: str = "Model",
        kind: OutputKind = "generic",
    ):
        super().__init__(model_type, label, kind=kind)

    def get_broadcast_data(self, value: NcnnModelWrapper):
        return {
            "inNc": value.in_nc,
            "outNc": value.out_nc,
            "scale": value.scale,
            "nf": value.nf,
            "fp": value.fp,
        }

    def get_broadcast_type(self, value: NcnnModelWrapper):
        return expression.named(
            "NcnnNetwork",
            {
                "scale": value.scale,
                "inputChannels": value.in_nc,
                "outputChannels": value.out_nc,
                "nf": value.nf,
                "fp": expression.literal(value.fp),
            },
        )
