from __future__ import annotations

from typing import Literal, Tuple

import onnxruntime as ort

OnnxInputShape = Literal["BCHW", "BHWC"]


def as_int(value) -> int | None:
    if isinstance(value, int):
        return value
    return None


def parse_onnx_shape(
    shape: Tuple[int | str, str | int, str | int, str | int]
) -> Tuple[OnnxInputShape, int, int | None, int | None]:
    if isinstance(shape[1], int) and shape[1] <= 4:
        return "BCHW", shape[1], as_int(shape[3]), as_int(shape[2])
    else:
        assert isinstance(shape[3], int), "Channels must be int"
        return "BHWC", shape[3], as_int(shape[2]), as_int(shape[1])


def get_input_shape(
    session: ort.InferenceSession,
) -> Tuple[OnnxInputShape, int, int | None, int | None]:
    """
    Returns the input shape, input channels, input width (optional), and input height (optional).
    """

    return parse_onnx_shape(session.get_inputs()[0].shape)


def get_output_shape(
    session: ort.InferenceSession,
) -> Tuple[OnnxInputShape, int, int | None, int | None]:
    """
    Returns the output shape, output channels, output width (optional), and output height (optional).
    """

    return parse_onnx_shape(session.get_outputs()[0].shape)
