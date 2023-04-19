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


class NvidiaHelper:
    def __init__(self):
        self.nvidia_is_available = nvidia_is_available
        if not nvidia_is_available:
            raise RuntimeError("Nvidia GPU not found, or invalid driver installed.")

        nv.nvmlInit()

        self.__num_gpus = nv.nvmlDeviceGetCount()

        self.__gpus = []
        for i in range(self.__num_gpus):
            handle = nv.nvmlDeviceGetHandleByIndex(i)
            self.__gpus.append(
                {
                    "name": nv.nvmlDeviceGetName(handle),
                    "uuid": nv.nvmlDeviceGetUUID(handle),
                    "index": i,
                    "handle": handle,
                }
            )

    def __del__(self):
        if nvidia_is_available:
            nv.nvmlShutdown()

    def list_gpus(self):
        if not nvidia_is_available:
            return None
        return self.__gpus

    def get_current_vram_usage(self, gpu_index=0):
        if not nvidia_is_available:
            return None

        info = nv.nvmlDeviceGetMemoryInfo(self.__gpus[gpu_index]["handle"])

        return info.total, info.used, info.free


__all__ = [
    "nvidia_is_available",
    "NvidiaHelper",
]
