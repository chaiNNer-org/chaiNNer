from __future__ import annotations

import os
from dataclasses import dataclass
from typing import List, cast

import onnxruntime as ort
from sanic.log import logger

from api import CacheSetting, DropdownSetting, ToggleSetting
from gpu import get_nvidia_helper
from system import is_arm_mac

from . import package

nv = get_nvidia_helper()

if not is_arm_mac:
    gpu_list = nv.list_gpus() if nv is not None else []

    package.add_setting(
        DropdownSetting(
            label="GPU",
            key="gpu_index",
            description="Which GPU to use for ONNX. This is only relevant if you have multiple GPUs.",
            options=[{"label": x, "value": str(i)} for i, x in enumerate(gpu_list)],
            default="0",
        )
    )


def get_providers():
    providers = cast(List[str], ort.get_available_providers())

    default = providers[0]
    if "CUDAExecutionProvider" in providers:
        default = "CUDAExecutionProvider"
    elif "CPUExecutionProvider" in providers:
        default = "CPUExecutionProvider"

    return providers, default


execution_providers, default_provider = get_providers()

if not is_arm_mac:
    package.add_setting(
        DropdownSetting(
            label="Execution Provider",
            key="execution_provider",
            description="What provider to use for ONNX.",
            options=[
                {"label": x.replace("ExecutionProvider", ""), "value": x}
                for x in execution_providers
            ],
            default=default_provider,
        )
    )

    package.add_setting(
        CacheSetting(
            label="Cache TensorRT Engines",
            key="onnx_tensorrt_cache",
            description="Whether to cache the converted TensorRT engines. This can significantly speed up subsequent runs.",
            directory="onnx_tensorrt_cache",
            disabled="TensorrtExecutionProvider" not in execution_providers,
        )
    )

    should_fp16 = False
    if nv is not None:
        should_fp16 = nv.get_can_fp16()

    package.add_setting(
        ToggleSetting(
            label="Use TensorRT FP16 Mode",
            key="tensorrt_fp16_mode",
            description="Runs TensorRT in half-precision (FP16) mode for less VRAM usage. RTX GPUs also get a speedup.",
            default=should_fp16,
            disabled="TensorrtExecutionProvider" not in execution_providers,
        )
    )


@dataclass(frozen=True)
class OnnxSettings:
    gpu_index: int
    execution_provider: str
    tensorrt_cache_path: str | None
    tensorrt_fp16_mode: bool


def get_settings() -> OnnxSettings:
    settings = package.get_settings()

    tensorrt_cache_path = settings.get_cache_location("onnx_tensorrt_cache")
    logger.info(f"TensorRT cache location: {tensorrt_cache_path}")
    if tensorrt_cache_path and not os.path.exists(tensorrt_cache_path):
        os.makedirs(tensorrt_cache_path)

    return OnnxSettings(
        gpu_index=settings.get_int("gpu_index", 0, parse_str=True),
        execution_provider=settings.get_str("execution_provider", default_provider),
        tensorrt_cache_path=tensorrt_cache_path,
        tensorrt_fp16_mode=settings.get_bool("tensorrt_fp16_mode", False),
    )
