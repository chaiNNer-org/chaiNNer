from typing import Literal
from sanic.log import logger


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
    logger.info(
        f"Execution options: fp16: {__global_exec_options.fp16}, device: {__global_exec_options.device}"
    )
    return __global_exec_options


def set_execution_options(value: ExecutionOptions):
    # TODO: Make the mutable global state unnecessary
    # pylint: disable=global-statement
    global __global_exec_options
    __global_exec_options = value
