from __future__ import annotations

import re


def is_pytorch_oom(error: BaseException) -> bool:
    if not isinstance(error, Exception):
        return False
    s = str(error).lower()
    return bool(
        re.search(r"cuda out of memory", s)
        or re.search(r"out of memory.*cuda", s)
        or re.search(r"allocating.*bytes.*cuda", s)
        or re.search(r"cuda error.*out of memory", s)
        or (isinstance(error, RuntimeError) and "out of memory" in s and "cuda" in s)
    )


def is_onnx_oom(error: BaseException) -> bool:
    if not isinstance(error, Exception):
        return False
    s = str(error).lower()
    etype = type(error).__name__.lower()
    is_onnx_error = "onnxruntimeerror" in etype or "onnxruntime" in s
    if not is_onnx_error:
        return False
    return bool(
        re.search(r"allocate memory", s)
        or re.search(r"out of memory", s)
        or re.search(r"cuda\s*malloc", s)
        or re.search(r"resource exhausted", s)
    )


def is_ncnn_oom(error: BaseException) -> bool:
    if not isinstance(error, Exception):
        return False
    s = str(error)
    if "vkQueueSubmit" in s:
        return False
    sl = s.lower()
    return bool(
        re.search(r"failed.*allocate", sl)
        or re.search(r"allocation.*failed", sl)
        or re.search(r"out of memory", sl)
        or re.search(r"vkqueuesubmit.*failed", sl)
    )


def is_tensorrt_oom(error: BaseException) -> bool:
    if not isinstance(error, Exception):
        return False
    s = str(error).lower()
    return bool(
        re.search(r"out of memory", s)
        or re.search(r"cuda.*memory.*allocate", s)
        or re.search(r"failed to allocate.*device memory", s)
        or re.search(r"memory allocation.*failed", s)
        or re.search(r"resource exhausted.*gpu", s)
    )


def is_cuda_oom(error: BaseException) -> bool:
    return (
        is_pytorch_oom(error)
        or is_onnx_oom(error)
        or is_ncnn_oom(error)
        or is_tensorrt_oom(error)
    )


_NON_OOM_INDICATORS = frozenset(
    [
        "assertion failed",
        "invalid argument",
        "invalid value",
        "unsupported operation",
        "not implemented",
        "file not found",
        "permission denied",
        "invalid model",
        "invalid input",
        "shape mismatch",
        "dimension mismatch",
        "type mismatch",
    ]
)


def is_non_oom_error(error: BaseException) -> bool:
    if not isinstance(error, Exception):
        return False
    s = str(error).lower()
    return any(indicator in s for indicator in _NON_OOM_INDICATORS)


class OomRecoveryExhaustedError(RuntimeError):
    def __init__(
        self,
        original_error: BaseException,
        attempts: int,
        last_tile_size: tuple[int, int],
    ):
        self.original_error = original_error
        self.attempts = attempts
        self.last_tile_size = last_tile_size
        super().__init__(
            f"VRAM out-of-memory recovery exhausted after {attempts} attempts "
            f"(last tile size: {last_tile_size[0]}x{last_tile_size[1]}). "
            f"Try using a smaller tile size, a smaller model, or reducing image resolution. "
            f"Original error: {original_error}"
        )
