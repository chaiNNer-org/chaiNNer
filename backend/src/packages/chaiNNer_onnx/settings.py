import os
from dataclasses import dataclass

import onnxruntime as ort
from sanic.log import logger

from api import CacheSetting, DropdownSetting, ToggleSetting
from gpu import get_nvidia_helper, nvidia_is_available
from system import is_arm_mac

from . import package

if not is_arm_mac:
    nv = get_nvidia_helper()
    gpu_list = nv.list_gpus() if nv is not None else []

    package.add_setting(
        DropdownSetting(
            label="GPU",
            key="gpu_index",
            description="Which GPU to use for ONNX. This is only relevant if you have multiple GPUs.",
            options=[{"label": x, "value": str(i)} for i, x in enumerate(gpu_list)],
            default="0",
            disabled=not nvidia_is_available or len(gpu_list) <= 1,
        )
    )


execution_providers = ort.get_available_providers()

package.add_setting(
    DropdownSetting(
        label="Execution Provider",
        key="execution_provider",
        description="What provider to use for ONNX.",
        options=[
            {"label": x.replace("ExecutionProvider", ""), "value": x}
            for x in execution_providers
        ],
        default=execution_providers[0],
        disabled=is_arm_mac or len(execution_providers) <= 1,
    )
)

package.add_setting(
    CacheSetting(
        label="Cache TensorRT Engines",
        key="onnx_tensorrt_cache",
        description="Whether to cache the converted TensorRT engines. This can significantly speed up subsequent runs.",
        disabled=is_arm_mac or "TensorrtExecutionProvider" not in execution_providers,
    )
)

package.add_setting(
    ToggleSetting(
        label="Use TensorRT FP16 Mode",
        key="tensorrt_fp16_mode",
        description="Runs TensorRT in half-precision (FP16) mode for less VRAM usage. RTX GPUs also get a speedup.",
        default=False,
        disabled=is_arm_mac or "TensorrtExecutionProvider" not in execution_providers,
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

    tensorrt_cache_dict = settings.get_cache("onnx_tensorrt_cache")
    logger.info(f"TensorRT cache dict: {tensorrt_cache_dict}")

    tensorrt_cache_path = tensorrt_cache_dict.get("location", "")
    should_tensorrt_cache = tensorrt_cache_dict.get("enabled", False)
    if not should_tensorrt_cache or not tensorrt_cache_path:
        tensorrt_cache_path = None

    if tensorrt_cache_path and not os.path.exists(tensorrt_cache_path):
        os.makedirs(tensorrt_cache_path)

    return OnnxSettings(
        gpu_index=settings.get_int("gpu_index", 0),
        execution_provider=settings.get_str(
            "execution_provider", execution_providers[0]
        ),
        tensorrt_cache_path=tensorrt_cache_path,
        tensorrt_fp16_mode=settings.get_bool("tensorrt_fp16_mode", False),
    )
