from __future__ import annotations

from typing import Literal

import onnxoptimizer
import onnxruntime as ort
from onnx.onnx_pb import ModelProto

OnnxInputShape = Literal["BCHW", "BHWC"]


def as_int(value: object) -> int | None:
    if isinstance(value, int):
        return value
    return None


def parse_onnx_shape(
    shape: tuple[int | str, str | int, str | int, str | int]
) -> tuple[int, int | None, int | None]:
    if isinstance(shape[1], int) and shape[1] <= 4:
        # BCHW
        return shape[1], as_int(shape[3]), as_int(shape[2])
    elif isinstance(shape[3], int) and shape[3] <= 4:
        # BHWC
        # Keep this code for validation: change order has always to be done
        # return shape[3], as_int(shape[2]), as_int(shape[1])
        raise ValueError("Unsupported image shape order")
    else:
        # BCHW
        return 3, as_int(shape[3]), as_int(shape[2])


def get_input_shape(
    session: ort.InferenceSession,
) -> tuple[int, int | None, int | None]:
    """
    Returns the input channels, input width (optional), and input height (optional).
    """

    return parse_onnx_shape(session.get_inputs()[0].shape)


def get_output_shape(
    session: ort.InferenceSession,
) -> tuple[int, int | None, int | None]:
    """
    Returns the output channels, output width (optional), and output height (optional).
    """

    return parse_onnx_shape(session.get_outputs()[0].shape)


def safely_optimize_onnx_model(model_proto: ModelProto) -> ModelProto:
    """
    Optimizes the model using onnxoptimizer. If onnxoptimizer is not installed, the model is returned as is.
    """
    try:
        passes = onnxoptimizer.get_fuse_and_elimination_passes()
        model_proto = onnxoptimizer.optimize(model_proto, passes)
    except Exception:
        pass
    return model_proto
