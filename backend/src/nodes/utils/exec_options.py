from typing import Literal


DeviceType = Literal["cpu", "cuda"]


class ExecutionOptions:
    def __init__(self, device: DeviceType, fp16: bool) -> None:
        self.__device: DeviceType = device
        self.__fp16 = fp16

    @property
    def device(self) -> DeviceType:
        return self.__device

    @property
    def fp16(self):
        return self.__fp16


__global_exec_options = ExecutionOptions("cpu", False)


def get_execution_options() -> ExecutionOptions:
    return __global_exec_options
