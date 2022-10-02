from __future__ import annotations

import torch

from .exec_options import ExecutionOptions


def to_pytorch_execution_options(options: ExecutionOptions):
    return ExecutionOptions(
        device="cuda"
        if torch.cuda.is_available() and options.device != "cpu"
        else "cpu",
        fp16=options.fp16,
        pytorch_gpu_index=options.pytorch_gpu_index,
        ncnn_gpu_index=options.ncnn_gpu_index,
        onnx_gpu_index=options.onnx_gpu_index,
        onnx_execution_provider=options.onnx_execution_provider,
    )
