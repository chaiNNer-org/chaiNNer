from sanic.log import logger


class ExecutionOptions:
    def __init__(
        self,
        device: str,
        fp16: bool,
        pytorch_gpu_index: int,
        ncnn_gpu_index: int,
    ) -> None:
        self.__device = device
        self.__fp16 = fp16
        self.__pytorch_gpu_index = pytorch_gpu_index
        self.__ncnn_gpu_index = ncnn_gpu_index

    @property
    def device(self) -> str:
        if self.__device == "cuda":
            return f"cuda:{self.__pytorch_gpu_index}"
        return self.__device

    @property
    def fp16(self):
        return self.__fp16

    @property
    def pytorch_gpu_index(self):
        return self.__pytorch_gpu_index

    @property
    def ncnn_gpu_index(self):
        return self.__ncnn_gpu_index


__global_exec_options = ExecutionOptions("cpu", False, 0, 0)


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
