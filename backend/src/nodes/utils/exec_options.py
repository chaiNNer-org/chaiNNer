from typing import Literal


DeviceType = Literal["cpu", "cuda"]


class ExecutionOptions:
    def __init__(self, device: DeviceType, fp16: bool) -> None:
        self.device: DeviceType = device
        self.fp16 = fp16


__global_exec_options = ExecutionOptions("cpu", False)


def get_execution_options() -> ExecutionOptions:
    return __global_exec_options
