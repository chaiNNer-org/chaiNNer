from __future__ import annotations

from spandrel import (
    ModelDescriptor,
)

import navi
from api import BaseOutput, OutputKind

from ...utils.format import format_channel_numbers


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
                "subType": navi.literal(value.purpose),
                "size": navi.literal("x".join(value.tags)),
            },
        )


def TorchScriptOutput():
    """Output a JIT traced model"""
    return BaseOutput("PyTorchScript", "Traced Model")
