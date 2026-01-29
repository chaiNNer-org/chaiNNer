from __future__ import annotations

import os
from dataclasses import dataclass

from api import CacheSetting, DropdownSetting, NodeContext, NumberSetting
from gpu import nvidia
from logger import logger

from . import package

if package is not None:
    package.add_setting(
        DropdownSetting(
            label="GPU",
            key="gpu_index",
            description="Which GPU to use for TensorRT. This is only relevant if you have multiple GPUs.",
            options=[{"label": d.name, "value": str(d.index)} for d in nvidia.devices],
            default="0",
        )
    )

    should_fp16 = nvidia.is_available and nvidia.all_support_fp16

    package.add_setting(
        DropdownSetting(
            label="Default Precision",
            key="default_precision",
            description="Default precision for building new TensorRT engines. FP16 is faster on RTX GPUs.",
            options=[
                {"label": "FP32 (Higher Precision)", "value": "fp32"},
                {"label": "FP16 (Faster on RTX GPUs)", "value": "fp16"},
            ],
            default="fp16" if should_fp16 else "fp32",
        )
    )

    package.add_setting(
        NumberSetting(
            label="Workspace Size (GB)",
            key="workspace_size",
            description="Maximum GPU memory to use during engine building. Larger values may allow better optimizations.",
            default=4.0,
            min=1.0,
            max=32.0,
        )
    )

    package.add_setting(
        CacheSetting(
            label="Engine Cache",
            key="engine_cache",
            description="Directory to cache built TensorRT engines. Engines are specific to your GPU and TensorRT version.",
            directory="tensorrt_engine_cache",
        )
    )

    package.add_setting(
        CacheSetting(
            label="Timing Cache",
            key="timing_cache",
            description="Directory for TensorRT timing cache. Speeds up engine building for similar models.",
            directory="tensorrt_timing_cache",
        )
    )


@dataclass(frozen=True)
class TensorRTSettings:
    gpu_index: int
    default_precision: str
    workspace_size: float
    engine_cache_path: str | None
    timing_cache_path: str | None


def _get_float(settings, key: str, default: float) -> float:
    """Helper to get float value from settings."""
    raw = settings._SettingsParser__settings.get(key, default)
    if isinstance(raw, (int, float)):
        return float(raw)
    return default


def get_settings(context: NodeContext) -> TensorRTSettings:
    settings = context.settings

    engine_cache_path = settings.get_cache_location("engine_cache")
    if engine_cache_path and not os.path.exists(engine_cache_path):
        os.makedirs(engine_cache_path)
        logger.info("Created TensorRT engine cache at: %s", engine_cache_path)

    timing_cache_path = settings.get_cache_location("timing_cache")
    if timing_cache_path and not os.path.exists(timing_cache_path):
        os.makedirs(timing_cache_path)
        logger.info("Created TensorRT timing cache at: %s", timing_cache_path)

    return TensorRTSettings(
        gpu_index=settings.get_int("gpu_index", 0, parse_str=True),
        default_precision=settings.get_str("default_precision", "fp32"),
        workspace_size=_get_float(settings, "workspace_size", 4.0),
        engine_cache_path=engine_cache_path,
        timing_cache_path=timing_cache_path,
    )
