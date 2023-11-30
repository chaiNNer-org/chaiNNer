from __future__ import annotations

from weakref import WeakKeyDictionary

import onnxruntime as ort

from .model import OnnxModel


def create_inference_session(
    model: OnnxModel,
    gpu_index: int,
    execution_provider: str,
    should_tensorrt_fp16: bool = False,
    tensorrt_cache_path: str | None = None,
) -> ort.InferenceSession:
    if execution_provider == "TensorrtExecutionProvider":
        providers = [
            (
                "TensorrtExecutionProvider",
                {
                    "device_id": gpu_index,
                    "trt_engine_cache_enable": tensorrt_cache_path is not None,
                    "trt_engine_cache_path": tensorrt_cache_path,
                    "trt_fp16_enable": should_tensorrt_fp16,
                },
            ),
            (
                "CUDAExecutionProvider",
                {
                    "device_id": gpu_index,
                },
            ),
            "CPUExecutionProvider",
        ]
    elif execution_provider == "CUDAExecutionProvider":
        providers = [
            (
                "CUDAExecutionProvider",
                {
                    "device_id": gpu_index,
                },
            ),
            "CPUExecutionProvider",
        ]
    else:
        providers = [execution_provider, "CPUExecutionProvider"]

    session = ort.InferenceSession(
        model.bytes,
        providers=providers,  # type: ignore
    )
    return session


__session_cache: WeakKeyDictionary[
    OnnxModel, ort.InferenceSession
] = WeakKeyDictionary()


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
