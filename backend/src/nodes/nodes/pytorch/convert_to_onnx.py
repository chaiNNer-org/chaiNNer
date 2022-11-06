from __future__ import annotations

from io import BytesIO
from typing import Tuple

import torch

from . import category as PyTorchCategory
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import SrModelInput, OnnxFpDropdown
from ...properties.outputs import OnnxModelOutput, TextOutput
from ...utils.exec_options import get_execution_options
from ...utils.pytorch_utils import to_pytorch_execution_options
from ...utils.onnx_model import OnnxModel
from ...utils.torch_types import PyTorchSRModel


@NodeFactory.register("chainner:pytorch:convert_to_onnx")
class ConvertTorchToONNXNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = """Convert a PyTorch model to ONNX.
            Note: fp16 conversion will only work if PyTorch fp16 mode is turned on."""
        self.inputs = [
            SrModelInput("PyTorch Model"),
            OnnxFpDropdown(),
        ]
        self.outputs = [
            OnnxModelOutput(label="ONNX Model"),
            TextOutput("FP Mode", "FpMode::toString(Input1)"),
        ]

        self.category = PyTorchCategory
        self.name = "Convert To ONNX"
        self.icon = "ONNX"
        self.sub = "Utility"

    def run(self, model: PyTorchSRModel, is_fp16: int) -> Tuple[OnnxModel, str]:
        fp16 = bool(is_fp16)
        exec_options = to_pytorch_execution_options(get_execution_options())
        if fp16:
            assert (
                exec_options.fp16
            ), "PyTorch fp16 mode must be supported and turned on in settings to convert model as fp16."

        model = model.eval()
        model = model.to(torch.device(exec_options.device))
        # https://github.com/onnx/onnx/issues/654
        dynamic_axes = {
            "input": {0: "batch_size", 2: "width", 3: "height"},
            "output": {0: "batch_size", 2: "width", 3: "height"},
        }
        dummy_input = torch.rand(1, model.in_nc, 64, 64)  # type: ignore
        dummy_input = dummy_input.to(torch.device(exec_options.device))

        should_use_fp16 = exec_options.fp16 and model.supports_fp16 and fp16
        if should_use_fp16:
            model = model.half()
            dummy_input = dummy_input.half()
        else:
            model = model.float()
            dummy_input = dummy_input.float()

        with BytesIO() as f:
            torch.onnx.export(
                model,
                dummy_input,
                f,
                opset_version=14,
                verbose=False,
                input_names=["input"],
                output_names=["output"],
                dynamic_axes=dynamic_axes,
                do_constant_folding=True,
            )
            f.seek(0)
            onnx_model_bytes = f.read()

        fp_mode = "fp16" if should_use_fp16 else "fp32"

        return OnnxModel(onnx_model_bytes), fp_mode
