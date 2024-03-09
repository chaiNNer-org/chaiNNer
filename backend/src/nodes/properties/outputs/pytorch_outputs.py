from __future__ import annotations

from spandrel import ModelDescriptor, ModelTiling

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
                value.architecture.name,
                format_channel_numbers(value.input_channels, value.output_channels),
                *value.tags,
            ]
        }

    def get_broadcast_type(self, value: ModelDescriptor):
        tiling_map: dict[ModelTiling, str] = {
            ModelTiling.SUPPORTED: "ModelTiling::Supported",
            ModelTiling.DISCOURAGED: "ModelTiling::Discouraged",
            ModelTiling.INTERNAL: "ModelTiling::Internal",
        }

        return navi.named(
            "PyTorchModel",
            {
                "scale": value.scale,
                "inputChannels": value.input_channels,
                "outputChannels": value.output_channels,
                "arch": navi.literal(value.architecture.name),
                "subType": navi.literal(value.purpose),
                "size": navi.literal("x".join(value.tags)),
                "tiling": tiling_map[value.tiling],
            },
        )


def TorchScriptOutput():
    """Output a JIT traced model"""
    return BaseOutput("PyTorchScript", "Traced Model")
