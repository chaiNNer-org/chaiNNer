from .. import expression
from .base_output import BaseOutput, OutputKind

from ...utils.torch_types import PyTorchModel


class ModelOutput(BaseOutput):
    def __init__(
        self,
        model_type: expression.ExpressionJson = "PyTorchModel",
        label: str = "Model",
        kind: OutputKind = "generic",
        should_broadcast=False,
    ):
        super().__init__(model_type, label, kind=kind)
        self.should_broadcast = should_broadcast

    def get_broadcast_data(self, value: PyTorchModel):
        if not self.should_broadcast:
            return None

        if "SRVGG" in value.model_type:  # type: ignore
            size = [f"{value.num_feat}nf", f"{value.num_conv}nc"]
        else:
            size = [
                f"{value.num_filters}nf",
                f"{value.num_blocks}nb",
            ]

        return {
            "modelType": value.model_type,
            "inNc": value.in_nc,
            "outNc": value.out_nc,
            "size": size,
            "scale": value.scale,
        }


def TorchScriptOutput():
    """Output a JIT traced model"""
    return BaseOutput("PyTorchScript", "Traced Model")
