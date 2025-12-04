from __future__ import annotations

from collections.abc import Callable, Sequence
from dataclasses import dataclass
from functools import cached_property

import pynvml as nv

from logger import logger

_FP16_ARCH_ABILITY_MAP = {
    nv.NVML_DEVICE_ARCH_KEPLER: False,
    nv.NVML_DEVICE_ARCH_MAXWELL: False,
    nv.NVML_DEVICE_ARCH_PASCAL: False,
    nv.NVML_DEVICE_ARCH_VOLTA: True,
    nv.NVML_DEVICE_ARCH_TURING: True,
    nv.NVML_DEVICE_ARCH_AMPERE: True,
    nv.NVML_DEVICE_ARCH_ADA: True,
    nv.NVML_DEVICE_ARCH_HOPPER: True,
    nv.NVML_DEVICE_ARCH_UNKNOWN: False,
}


@dataclass
class MemoryUsage:
    total: int
    used: int
    free: int


@dataclass(frozen=True)
class NvDevice:
    index: int
    handle: nv.c_nvmlDevice_t
    name: str

    @staticmethod
    def from_index(index: int) -> NvDevice:
        handle = nv.nvmlDeviceGetHandleByIndex(index)

        return NvDevice(
            index=index,
            handle=handle,
            name=nv.nvmlDeviceGetName(handle),
        )

    @cached_property
    def architecture(self) -> int:
        # We catch and ignore errors to support older drivers that don't have nvmlDeviceGetArchitecture
        try:
            return nv.nvmlDeviceGetArchitecture(self.handle)
        except Exception:
            return nv.NVML_DEVICE_ARCH_UNKNOWN

    @property
    def supports_fp16(self):
        arch = self.architecture

        # This generation also contains the GTX 1600 cards, which do not support FP16.
        if arch == nv.NVML_DEVICE_ARCH_TURING:
            return "RTX" in self.name

        # Future proofing. We can be reasonably sure that future architectures will support FP16.
        return _FP16_ARCH_ABILITY_MAP.get(arch, arch > nv.NVML_DEVICE_ARCH_HOPPER)

    def get_current_vram_usage(self) -> MemoryUsage:
        info = nv.nvmlDeviceGetMemoryInfo(self.handle)
        return MemoryUsage(info.total, info.used, info.free)  # type: ignore


class NvInfo:
    def __init__(self, devices: Sequence[NvDevice], clean_up: Callable[[], None]):
        self.__devices: Sequence[NvDevice] = devices
        self.__clean_up = clean_up

    @staticmethod
    def unavailable():
        return NvInfo([], lambda: None)

    def __del__(self):
        self.__clean_up()

    @property
    def devices(self) -> Sequence[NvDevice]:
        return self.__devices

    @property
    def is_available(self):
        return len(self.devices) > 0

    @property
    def all_support_fp16(self) -> bool:
        return all(gpu.supports_fp16 for gpu in self.devices)

    @property
    def any_needs_legacy_cuda(self) -> bool:
        """
        Check if any device needs legacy CUDA version (12.6 instead of 12.8).
        CUDA 12.8 dropped support for Pascal (GTX 1000 series) and older architectures.
        """
        for gpu in self.devices:
            arch = gpu.architecture
            # Pascal and older architectures need CUDA 12.6
            if arch in (
                nv.NVML_DEVICE_ARCH_PASCAL,
                nv.NVML_DEVICE_ARCH_MAXWELL,
                nv.NVML_DEVICE_ARCH_KEPLER,
            ):
                return True
        return False


def _try_nvml_init():
    try:
        nv.nvmlInit()
        return True
    except Exception as e:
        if isinstance(e, nv.NVMLError):
            logger.info("No Nvidia GPU found, or invalid driver installed.")
        else:
            logger.info(
                "Unknown error occurred when trying to initialize Nvidia GPU: %s", e
            )
        return False


def _try_nvml_shutdown():
    try:
        nv.nvmlShutdown()
    except Exception:
        logger.warning("Failed to shut down Nvidia GPU.", exc_info=True)


def _get_nvidia_info() -> NvInfo:
    if not _try_nvml_init():
        return NvInfo.unavailable()

    try:
        device_count = nv.nvmlDeviceGetCount()
        devices = [NvDevice.from_index(i) for i in range(device_count)]
        return NvInfo(devices, _try_nvml_shutdown)
    except Exception as e:
        logger.info(
            "Unknown error occurred when trying to initialize Nvidia GPU: %s", e
        )
        _try_nvml_shutdown()
        return NvInfo.unavailable()


nvidia = _get_nvidia_info()


__all__ = ["MemoryUsage", "NvDevice", "NvInfo", "nvidia"]
