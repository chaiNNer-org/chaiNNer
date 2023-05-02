from typing import List

from ...impl.pytorch.types import PyTorchModel
from ...utils.format import format_channel_numbers
from .. import expression
from .base_output import BaseOutput, OutputKind


def _get_sizes(value: PyTorchModel) -> List[str]:
    if "SRVGG" in value.model_arch:
        return [f"{value.num_feat}nf", f"{value.num_conv}nc"]
    elif (
        "SwinIR" in value.model_arch
        or "Swin2SR" in value.model_arch
        or "HAT" in value.model_arch
    ):
        head_length = len(value.depths)  # type: ignore
        if head_length <= 4:
            size_tag = "small"
        elif head_length < 9:
            size_tag = "medium"
        else:
            size_tag = "large"
        return [
            size_tag,
            f"s{value.img_size}w{value.window_size}",
            f"{value.num_feat}nf",
        ]
    elif value.model_arch in [
        "GFPGAN",
        "RestoreFormer",
        "CodeFormer",
        "LaMa",
        "MAT",
    ]:
        return []
    else:
        return [
            f"{value.num_filters}nf",
            f"{value.num_blocks}nb",
        ]


class ModelOutput(BaseOutput):
    def __init__(
        self,
        model_type: expression.ExpressionJson = "PyTorchModel",
        label: str = "Model",
        kind: OutputKind = "generic",
    ):
        super().__init__(model_type, label, kind=kind, associated_type=PyTorchModel)

    def get_broadcast_data(self, value: PyTorchModel):
        return {
            "tags": [
                value.model_arch,
                format_channel_numbers(value.in_nc, value.out_nc),
                *_get_sizes(value),
            ]
        }

    def get_broadcast_type(self, value: PyTorchModel):
        return expression.named(
            "PyTorchModel",
            {
                "scale": value.scale,
                "inputChannels": value.in_nc,
                "outputChannels": value.out_nc,
                "arch": expression.literal(value.model_arch),
                "subType": expression.literal(value.sub_type),
                "size": expression.literal("x".join(_get_sizes(value))),
            },
        )


def TorchScriptOutput():
    """Output a JIT traced model"""
    return BaseOutput("PyTorchScript", "Traced Model")
