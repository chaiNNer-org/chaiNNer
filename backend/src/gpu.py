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
        nv.nvmlShutdown()

    def list_gpus(self):
        return self.__gpus

    def get_current_vram_usage(self, gpu_index=0):
        info = nv.nvmlDeviceGetMemoryInfo(self.__gpus[gpu_index]["handle"])

        return info.total, info.used, info.free


__all__ = [
    "nvidia_is_available",
    "NvidiaHelper",
]
