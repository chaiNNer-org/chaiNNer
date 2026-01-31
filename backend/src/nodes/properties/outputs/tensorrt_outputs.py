from __future__ import annotations

import navi
from api import BaseOutput, OutputKind
from nodes.utils.format import format_channel_numbers

from ...impl.tensorrt.model import TensorRTEngine


class TensorRTEngineOutput(BaseOutput):
    """Output for TensorRT engine."""

    def __init__(
        self,
        model_type: navi.ExpressionJson = "TensorRTEngine",
        label: str = "TensorRT Engine",
        kind: OutputKind = "generic",
    ):
        super().__init__(model_type, label, kind=kind, associated_type=TensorRTEngine)

    def get_broadcast_data(self, value: TensorRTEngine):
        i = value.info

        tags: list[str] = []

        # Add channel info
        tags.append(format_channel_numbers(i.input_channels, i.output_channels))

        # Add scale info
        if i.scale is not None:
            tags.append(f"{i.scale}x")

        # Add precision
        tags.append(i.precision.upper())

        # Add architecture
        # tags.append(i.gpu_architecture)

        # Add shape info
        if i.has_dynamic_shapes:
            tags.append("Dynamic")
            if i.min_shape is not None:
                tags.append("Min: " + str(i.min_shape[2]) + "x" + str(i.min_shape[3]))
            if i.opt_shape is not None:
                tags.append("Opt: " + str(i.opt_shape[2]) + "x" + str(i.opt_shape[3]))
            if i.max_shape is not None:
                tags.append("Max: " + str(i.max_shape[2]) + "x" + str(i.max_shape[3]))
        else:
            tags.append("Fixed")
            if i.opt_shape is not None:
                tags.append(str(i.opt_shape[2]) + "x" + str(i.opt_shape[3]))

        return {"tags": tags}

    def get_broadcast_type(self, value: TensorRTEngine):
        fields: dict[str, navi.ExpressionJson] = {
            "precision": navi.literal(value.info.precision),
        }

        i = value.info
        if i.scale is not None:
            fields["scale"] = i.scale
        if i.input_channels:
            fields["inputChannels"] = i.input_channels
        if i.output_channels:
            fields["outputChannels"] = i.output_channels

        return navi.named("TensorRTEngine", fields)
