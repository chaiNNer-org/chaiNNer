from __future__ import annotations

from spandrel import (
    FaceSRModelDescriptor,
    InpaintModelDescriptor,
    ModelDescriptor,
    RestorationModelDescriptor,
    SRModelDescriptor,
)

import navi
from api import BaseOutput, OutputKind

from ...utils.format import format_channel_numbers


def get_sub_type(model_descriptor: ModelDescriptor) -> str:
    if isinstance(model_descriptor, SRModelDescriptor):
        return "SR"
    elif isinstance(model_descriptor, InpaintModelDescriptor):
        return "Inpainting"
    elif isinstance(model_descriptor, RestorationModelDescriptor):
        return "Restoration"
    elif isinstance(model_descriptor, FaceSRModelDescriptor):  # type: ignore <- it wants me to just put this in an else
        return "FaceSR"
    else:
        return "Unknown"


class ModelOutput(BaseOutput):
    def __init__(
        self,
        model_type: navi.ExpressionJson = "PyTorchModel",
        label: str = "Model",
        kind: OutputKind = "generic",
    ):
        super().__init__(model_type, label, kind=kind, associated_type=ModelDescriptor)

    def get_broadcast_data(self, value: ModelDescriptor):
        return {
            "tags": [
                value.architecture,
                format_channel_numbers(value.input_channels, value.output_channels),
                *value.tags,
            ]
        }

    def get_broadcast_type(self, value: ModelDescriptor):
        return navi.named(
            "PyTorchModel",
            {
                "scale": value.scale,
                "inputChannels": value.input_channels,
                "outputChannels": value.output_channels,
                "arch": navi.literal(value.architecture),
                "subType": navi.literal(get_sub_type(value)),
                "size": navi.literal("x".join(value.tags)),
            },
        )


def TorchScriptOutput():
    """Output a JIT traced model"""
    return BaseOutput("PyTorchScript", "Traced Model")
