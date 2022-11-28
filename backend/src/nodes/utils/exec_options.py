import os
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
        onnx_should_tensorrt_cache: bool,
        onnx_tensorrt_cache_path: str,
    ) -> None:
        self.__device = device
        self.__fp16 = fp16
        self.__pytorch_gpu_index = pytorch_gpu_index
        self.__ncnn_gpu_index = ncnn_gpu_index
        self.__onnx_gpu_index = onnx_gpu_index
        self.__onnx_execution_provider = onnx_execution_provider
        self.__onnx_should_tensorrt_cache = onnx_should_tensorrt_cache
        self.__onnx_tensorrt_cache_path = onnx_tensorrt_cache_path

        print(onnx_tensorrt_cache_path)

        if (
            not os.path.exists(onnx_tensorrt_cache_path)
            and onnx_tensorrt_cache_path != ""
        ):
            os.makedirs(onnx_tensorrt_cache_path)

        logger.info(
            f"PyTorch execution options: fp16: {fp16}, device: {self.full_device} | NCNN execution options: gpu_index: {ncnn_gpu_index} | ONNX execution options: gpu_index: {onnx_gpu_index}, execution_provider: {onnx_execution_provider}, should_tensorrt_cache: {onnx_should_tensorrt_cache}, tensorrt_cache_path: {onnx_tensorrt_cache_path}"
        )

    @property
    def full_device(self) -> str:
        if self.__device != "cpu" and self.__pytorch_gpu_index is not None:
            return f"{self.__device}:{self.__pytorch_gpu_index}"
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

    @property
    def onnx_should_tensorrt_cache(self):
        return self.__onnx_should_tensorrt_cache

    @property
    def onnx_tensorrt_cache_path(self):
        return self.__onnx_tensorrt_cache_path


__global_exec_options = ExecutionOptions(
    "cpu", False, 0, 0, 0, "CPUExecutionProvider", False, ""
)


def get_execution_options() -> ExecutionOptions:
    return __global_exec_options


def set_execution_options(value: ExecutionOptions):
    # TODO: Make the mutable global state unnecessary
    # pylint: disable=global-statement
    global __global_exec_options
    __global_exec_options = value
