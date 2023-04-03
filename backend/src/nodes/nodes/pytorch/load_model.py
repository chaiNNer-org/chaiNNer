from __future__ import annotations

import os
from typing import Tuple

import torch
from sanic.log import logger

from ...impl.pytorch.model_loading import load_state_dict
from ...impl.pytorch.types import PyTorchModel
from ...impl.pytorch.utils import to_pytorch_execution_options
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import PthFileInput
from ...properties.outputs import DirectoryOutput, FileNameOutput, ModelOutput
from ...utils.exec_options import get_execution_options
from ...utils.unpickler import RestrictedUnpickle
from ...utils.utils import split_file_path
from . import category as PyTorchCategory


@NodeFactory.register("chainner:pytorch:load_model")
class LoadModelNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = """Load PyTorch state dict (.pth) or TorchScript (.pt) file
            into an auto-detected supported model architecture.
            Supports most variations of the RRDB architecture
            (ESRGAN, Real-ESRGAN, RealSR, BSRGAN, SPSR),
            Real-ESRGAN's SRVGG architecture, Swift-SRGAN, SwinIR, Swin2SR, and HAT."""
        self.inputs = [PthFileInput(primary_input=True)]
        self.outputs = [
            ModelOutput(kind="tagged"),
            DirectoryOutput("Model Directory", of_input=0).with_id(2),
            FileNameOutput("Model Name", of_input=0).with_id(1),
        ]

        self.category = PyTorchCategory
        self.name = "Load Model"
        self.icon = "PyTorch"
        self.sub = "Input & Output"

    def run(self, path: str) -> Tuple[PyTorchModel, str, str]:
        """Read a pth file from the specified path and return it as a state dict
        and loaded model after finding arch config"""

        assert os.path.exists(path), f"Model file at location {path} does not exist"

        assert os.path.isfile(path), f"Path {path} is not a file"

        exec_options = to_pytorch_execution_options(get_execution_options())

        try:
            logger.debug(f"Reading state dict from path: {path}")

            if os.path.splitext(path)[1].lower() == ".pt":
                state_dict = torch.jit.load(  # type: ignore
                    path, map_location=torch.device(exec_options.full_device)
                ).state_dict()
            else:
                state_dict = torch.load(
                    path,
                    map_location=torch.device(exec_options.full_device),
                    pickle_module=RestrictedUnpickle,  # type: ignore
                )

            model = load_state_dict(state_dict)

            for _, v in model.named_parameters():
                v.requires_grad = False
            model.eval()
            model = model.to(torch.device(exec_options.full_device))
            if not hasattr(model, "supports_fp16"):
                model.supports_fp16 = False  # type: ignore
            should_use_fp16 = exec_options.fp16 and model.supports_fp16
            if should_use_fp16:
                model = model.half()
            else:
                model = model.float()
        except Exception as e:
            raise ValueError(
                f"Model {os.path.basename(path)} is unsupported by chaiNNer. Please try another."
            ) from e

        dirname, basename, _ = split_file_path(path)
        return model, dirname, basename
