from dataclasses import dataclass
from typing import List, Tuple, Union

import pynvml as nv
from sanic.log import logger

nvidia_is_available = False

try:
    nv.nvmlInit()
    nvidia_is_available = True
    nv.nvmlShutdown()
except nv.NVMLError as e:
    logger.info("No Nvidia GPU found, or invalid driver installed.")
except Exception as e:
    logger.info(f"Unknown error occurred when trying to initialize Nvidia GPU: {e}")

FP16_ABILITY_MAP = {
    nv.NVML_DEVICE_ARCH_KEPLER: False,
    nv.NVML_DEVICE_ARCH_MAXWELL: False,
    nv.NVML_DEVICE_ARCH_PASCAL: False,
    nv.NVML_DEVICE_ARCH_VOLTA: True,
    nv.NVML_DEVICE_ARCH_TURING: True,
    nv.NVML_DEVICE_ARCH_AMPERE: True,
    nv.NVML_DEVICE_ARCH_ADA: True,
    nv.NVML_DEVICE_ARCH_HOPPER: True,
}


@dataclass
class _GPU:
    name: str
    uuid: str
    index: int
    handle: int
    arch: int


class NvidiaHelper:
    def __init__(self):
        nv.nvmlInit()

        self.__num_gpus = nv.nvmlDeviceGetCount()

        self.__gpus: List[_GPU] = []
        for i in range(self.__num_gpus):
            handle = nv.nvmlDeviceGetHandleByIndex(i)
            self.__gpus.append(
                _GPU(
                    name=nv.nvmlDeviceGetName(handle),
                    uuid=nv.nvmlDeviceGetUUID(handle),
                    index=i,
                    handle=handle,
                    arch=nv.nvmlDeviceGetArchitecture(handle),
                )
            )

    def __del__(self):
        nv.nvmlShutdown()

    @property
    def num_gpus(self):
        return self.__num_gpus

    def list_gpus(self) -> List[str]:
        return [gpu.name for gpu in self.__gpus]

    def get_current_vram_usage(self, gpu_index=0) -> Tuple[int, int, int]:
        info = nv.nvmlDeviceGetMemoryInfo(self.__gpus[gpu_index].handle)

        return info.total, info.used, info.free

    def get_can_fp16(self, gpu_index: Union[int, None] = None) -> bool:
        if gpu_index is None:
            return all(FP16_ABILITY_MAP[gpu.arch] for gpu in self.__gpus)
        arch = self.__gpus[gpu_index].arch
        return FP16_ABILITY_MAP[arch]


_cachedNvidiaHelper = None


def get_nvidia_helper():
    # pylint: disable=global-statement
    global _cachedNvidiaHelper
    if not nvidia_is_available:
        return None
    if not _cachedNvidiaHelper:
        _cachedNvidiaHelper = NvidiaHelper()
    return _cachedNvidiaHelper


__all__ = [
    "nvidia_is_available",
    "get_nvidia_helper",
]
