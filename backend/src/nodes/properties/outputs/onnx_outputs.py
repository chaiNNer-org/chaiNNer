from __future__ import annotations

import navi
from api import BaseOutput, OutputKind
from nodes.utils.format import format_channel_numbers

from ...impl.onnx.model import OnnxModel


class OnnxModelOutput(BaseOutput):
    """Output for onnx model"""

    def __init__(
        self,
        model_type: navi.ExpressionJson = "OnnxModel",
        label: str = "Model",
        kind: OutputKind = "generic",
    ):
        super().__init__(model_type, label, kind=kind, associated_type=OnnxModel)

    def get_broadcast_data(self, value: OnnxModel):
        i = value.info

        tags: list[str] = []
        if i.input_channels is not None and i.output_channels is not None:
            tags.append(format_channel_numbers(i.input_channels, i.output_channels))

        tags.append(f"opset{i.opset}")
        tags.append(i.dtype)

        return {"tags": tags}

    def get_broadcast_type(self, value: OnnxModel):
        fields = {
            "subType": navi.literal(value.sub_type),
        }

        i = value.info
        if i.scale_width is not None:
            fields["scaleWidth"] = i.scale_width
        if i.scale_height is not None:
            fields["scaleHeight"] = i.scale_height
        if i.input_channels is not None:
            fields["inputChannels"] = i.input_channels
        if i.output_channels is not None:
            fields["outputChannels"] = i.output_channels

        return navi.named("OnnxModel", fields)
