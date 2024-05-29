from __future__ import annotations

from typing import Any, Dict, Tuple, Union
from weakref import WeakKeyDictionary

import onnxruntime as ort

from .model import OnnxModel
from .utils import OnnxParsedTensorShape, parse_onnx_shape

ProviderDesc = Union[str, Tuple[str, Dict[Any, Any]]]


def create_inference_session(
    model: OnnxModel,
    gpu_index: int,
    execution_provider: str,
    should_tensorrt_fp16: bool = False,
    tensorrt_cache_path: str | None = None,
) -> ort.InferenceSession:
    tensorrt: ProviderDesc = (
        "TensorrtExecutionProvider",
        {
            "device_id": gpu_index,
            "trt_engine_cache_enable": tensorrt_cache_path is not None,
            "trt_engine_cache_path": tensorrt_cache_path,
            "trt_fp16_enable": should_tensorrt_fp16,
        },
    )
    cuda: ProviderDesc = (
        "CUDAExecutionProvider",
        {
            "device_id": gpu_index,
        },
    )
    cpu: ProviderDesc = "CPUExecutionProvider"

    if execution_provider == "TensorrtExecutionProvider":
        providers = [tensorrt, cuda, cpu]
    elif execution_provider == "CUDAExecutionProvider":
        providers = [cuda, cpu]
    else:
        providers = [execution_provider, cpu]

    session = ort.InferenceSession(
        model.bytes,
        providers=providers,
    )
    return session


__session_cache: WeakKeyDictionary[OnnxModel, ort.InferenceSession] = (
    WeakKeyDictionary()
)


def get_onnx_session(
    model: OnnxModel,
    gpu_index: int,
    execution_provider: str,
    should_tensorrt_fp16: bool,
    tensorrt_cache_path: str | None = None,
) -> ort.InferenceSession:
    cached = __session_cache.get(model)
    if cached is None:
        cached = create_inference_session(
            model,
            gpu_index,
            execution_provider,
            should_tensorrt_fp16,
            tensorrt_cache_path,
        )
        __session_cache[model] = cached
    return cached


def get_input_shape(session: ort.InferenceSession) -> OnnxParsedTensorShape:
    """
    Returns the input shape, input channels, input width (optional), and input height (optional).
    """

    return parse_onnx_shape(session.get_inputs()[0].shape)


def get_output_shape(session: ort.InferenceSession) -> OnnxParsedTensorShape:
    """
    Returns the output shape, output channels, output width (optional), and output height (optional).
    """

    return parse_onnx_shape(session.get_outputs()[0].shape)
