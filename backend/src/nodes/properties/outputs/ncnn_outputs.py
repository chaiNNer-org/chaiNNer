import navi

from ...impl.ncnn.model import NcnnModelWrapper
from ...utils.format import format_channel_numbers
from .base_output import BaseOutput, OutputKind


class NcnnModelOutput(BaseOutput):
    def __init__(
        self,
        model_type: navi.ExpressionJson = "NcnnNetwork",
        label: str = "Model",
        kind: OutputKind = "generic",
    ):
        super().__init__(model_type, label, kind=kind, associated_type=NcnnModelWrapper)

    def get_broadcast_data(self, value: NcnnModelWrapper):
        return {
            "tags": [
                format_channel_numbers(value.in_nc, value.out_nc),
                f"{value.nf}nf",
                value.fp,
            ]
        }

    def get_broadcast_type(self, value: NcnnModelWrapper):
        return navi.named(
            "NcnnNetwork",
            {
                "scale": value.scale,
                "inputChannels": value.in_nc,
                "outputChannels": value.out_nc,
                "nf": value.nf,
                "fp": navi.literal(value.fp),
            },
        )
