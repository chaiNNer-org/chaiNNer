# This class defines an interface.
# It is important that is does not contain types that depend on ONNX.
from __future__ import annotations

from dataclasses import dataclass
from typing import Final, Literal, Union

OnnxSubType = Literal["Generic", "RemBg"]


def _ceil_div(a: int, b: int):
    return -(a // -b)


@dataclass(init=False)
class SizeReq:
    minimum: int
    multiple_of: int

    def __init__(self, minimum: int = 1, multiple_of: int = 1):
        if minimum < 1:
            raise ValueError("minimum must be at least 1")
        if multiple_of < 1:
            raise ValueError("multiple_of must be at least 1")

        self.minimum = _ceil_div(minimum, multiple_of) * multiple_of
        self.multiple_of = multiple_of

    def get_padding(self, width: int, height: int) -> tuple[int, int]:
        """
        Given an image size, this returns the minimum amount of padding necessary to satisfy the size requirements. The returned padding is in the format `(pad_width, pad_height)` and is guaranteed to be non-negative.
        """

        def ceil_modulo(x: int, mod: int) -> int:
            if x % mod == 0:
                return x
            return (x // mod + 1) * mod

        w: int = max(self.minimum, width)
        h: int = max(self.minimum, height)

        w = ceil_modulo(w, self.multiple_of)
        h = ceil_modulo(h, self.multiple_of)

        return w - width, h - height


NO_SIZE_REQ = SizeReq()


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

    size_req: SizeReq = NO_SIZE_REQ


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
