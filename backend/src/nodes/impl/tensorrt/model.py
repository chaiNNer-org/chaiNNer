# This class defines an interface.
# It is important that it does not contain types that depend on TensorRT.
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


@dataclass
class TensorRTEngineInfo:
    """Metadata about a TensorRT engine."""

    precision: Literal["fp32", "fp16", "int8"]
    input_channels: int
    output_channels: int
    scale: int | None
    gpu_architecture: str
    tensorrt_version: str
    has_dynamic_shapes: bool
    min_shape: tuple[int, int] | None  # (width, height)
    opt_shape: tuple[int, int] | None  # (width, height)
    max_shape: tuple[int, int] | None  # (width, height)


class TensorRTEngine:
    """
    A wrapper class for TensorRT engine data.

    This class holds the serialized engine bytes and metadata without
    requiring TensorRT to be imported. The actual engine loading and
    inference are handled by separate utility functions.
    """

    def __init__(self, engine_bytes: bytes, info: TensorRTEngineInfo):
        self.bytes: bytes = engine_bytes
        self.info: TensorRTEngineInfo = info

    @property
    def precision(self) -> Literal["fp32", "fp16", "int8"]:
        return self.info.precision

    @property
    def scale(self) -> int | None:
        return self.info.scale

    @property
    def input_channels(self) -> int:
        return self.info.input_channels

    @property
    def output_channels(self) -> int:
        return self.info.output_channels

    @property
    def has_dynamic_shapes(self) -> bool:
        return self.info.has_dynamic_shapes
