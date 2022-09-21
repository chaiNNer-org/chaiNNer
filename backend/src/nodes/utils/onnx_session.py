from __future__ import annotations
import onnxruntime as ort
from weakref import WeakKeyDictionary

from .exec_options import ExecutionOptions
from .onnx_model import OnnxModel


def create_inference_session(
    model: OnnxModel, exec_options: ExecutionOptions
) -> ort.InferenceSession:
    if exec_options.onnx_execution_provider == "TensorrtExecutionProvider":
        providers = [
            (
                "TensorrtExecutionProvider",
                {
                    "device_id": exec_options.onnx_gpu_index,
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

    session = ort.InferenceSession(model.model, providers=providers)
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
