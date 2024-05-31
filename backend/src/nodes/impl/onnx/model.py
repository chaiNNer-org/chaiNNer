# This class defines an interface.
# It is important that is does not contain types that depend on ONNX.
from __future__ import annotations

from dataclasses import dataclass
from typing import Final, Literal, Union

OnnxSubType = Literal["Generic", "RemBg"]


@dataclass
class OnnxInfo:
    opset: int
    dtype: str

    scale_width: int | None = None
    scale_height: int | None = None

    fixed_input_width: int | None = None
    fixed_input_height: int | None = None

    input_channels: int | None = None
    output_channels: int | None = None


class OnnxGeneric:
    def __init__(self, model_as_bytes: bytes, info: OnnxInfo):
        self.bytes: bytes = model_as_bytes
        self.sub_type: Final[Literal["Generic"]] = "Generic"
        self.info: OnnxInfo = info


class OnnxRemBg:
    def __init__(
        self,
        model_as_bytes: bytes,
        info: OnnxInfo,
    ):
        self.bytes: bytes = model_as_bytes
        self.sub_type: Final[Literal["RemBg"]] = "RemBg"
        self.info: OnnxInfo = info


OnnxModels = (OnnxGeneric, OnnxRemBg)
OnnxModel = Union[OnnxGeneric, OnnxRemBg]
