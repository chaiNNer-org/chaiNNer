from __future__ import annotations

from weakref import WeakKeyDictionary

import onnxruntime as ort

from system import is_arm_mac

from ...utils.exec_options import ExecutionOptions
from .model import OnnxModel


def create_inference_session(
    model: OnnxModel, exec_options: ExecutionOptions
) -> ort.InferenceSession:
    if exec_options.onnx_execution_provider == "TensorrtExecutionProvider":
        providers = [
            (
                "TensorrtExecutionProvider",
                {
                    "device_id": exec_options.onnx_gpu_index,
                    "trt_engine_cache_enable": exec_options.onnx_should_tensorrt_cache,
                    "trt_engine_cache_path": exec_options.onnx_tensorrt_cache_path,
                    "trt_fp16_enable": exec_options.onnx_should_tensorrt_fp16,
                },
            ),
            (
                "CUDAExecutionProvider",
                {
                    "device_id": exec_options.onnx_gpu_index,
                },
            ),
            "CPUExecutionProvider",
        ]
    elif exec_options.onnx_execution_provider == "CUDAExecutionProvider":
        providers = [
            (
                "CUDAExecutionProvider",
                {
                    "device_id": exec_options.onnx_gpu_index,
                },
            ),
            "CPUExecutionProvider",
        ]
    else:
        providers = [exec_options.onnx_execution_provider, "CPUExecutionProvider"]

    session = ort.InferenceSession(model.bytes, providers=providers)
    return session


__session_cache: WeakKeyDictionary[
    OnnxModel, ort.InferenceSession
] = WeakKeyDictionary()


def get_onnx_session(
    model: OnnxModel, exec_options: ExecutionOptions
) -> ort.InferenceSession:
    cached = __session_cache.get(model)
    if cached is None:
        cached = create_inference_session(model, exec_options)
        __session_cache[model] = cached
    return cached
