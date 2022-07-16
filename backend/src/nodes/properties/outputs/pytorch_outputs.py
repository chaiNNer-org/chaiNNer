try:
    import torch
except:
    torch = None

from typing import Union

from ...properties import expression
from .base_output import BaseOutput

try:
    from ...utils.architecture.RRDB import RRDBNet as ESRGAN
    from ...utils.architecture.SPSR import SPSRNet as SPSR
    from ...utils.architecture.SRVGG import SRVGGNetCompact as RealESRGANv2
    from ...utils.architecture.SwiftSRGAN import Generator as SwiftSRGAN

    PyTorchModel = Union[RealESRGANv2, SPSR, SwiftSRGAN, ESRGAN]
except:
    PyTorchModel = None


class ModelOutput(BaseOutput):
    def __init__(
        self,
        model_type: expression.ExpressionJson = "PyTorchModel",
        label: str = "Model",
    ):
        super().__init__(model_type, label)

    def broadcast(self, value: PyTorchModel) -> dict:  # type: ignore
        if torch is not None:
            assert isinstance(value, torch.nn.Module), "Expected a PyTorch model"

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
