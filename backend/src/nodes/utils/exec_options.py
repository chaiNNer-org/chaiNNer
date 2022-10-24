from sanic.log import logger


class ExecutionOptions:
    def __init__(
        self,
        device: str,
        fp16: bool,
        pytorch_gpu_index: int,
        ncnn_gpu_index: int,
        onnx_gpu_index: int,
        onnx_execution_provider: str,
    ) -> None:
        self.__device = device
        self.__fp16 = fp16
        self.__pytorch_gpu_index = pytorch_gpu_index
        self.__ncnn_gpu_index = ncnn_gpu_index
        self.__onnx_gpu_index = onnx_gpu_index
        self.__onnx_execution_provider = onnx_execution_provider

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

    @property
    def onnx_gpu_index(self):
        return self.__onnx_gpu_index

    @property
    def onnx_execution_provider(self):
        return self.__onnx_execution_provider


__global_exec_options = ExecutionOptions("cpu", False, 0, 0, 0, "CPUExecutionProvider")


def get_execution_options() -> ExecutionOptions:
    logger.info(
        f"PyTorch execution options: fp16: {__global_exec_options.fp16}, device: {__global_exec_options.device} | NCNN execution options: gpu_index: {__global_exec_options.ncnn_gpu_index} | ONNX execution options: gpu_index: {__global_exec_options.onnx_gpu_index}, execution_provider: {__global_exec_options.onnx_execution_provider}"
    )
    return __global_exec_options


def set_execution_options(value: ExecutionOptions):
    # TODO: Make the mutable global state unnecessary
    # pylint: disable=global-statement
    global __global_exec_options
    __global_exec_options = value
