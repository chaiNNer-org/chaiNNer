from __future__ import annotations

import os
from typing import Tuple

import torch
from sanic.log import logger

from . import category as PyTorchCategory
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import PthFileInput
from ...properties.outputs import ModelOutput, DirectoryOutput, TextOutput
from ...utils.exec_options import get_execution_options
from ...utils.torch_types import PyTorchModel
from ...utils.pytorch_model_loading import load_state_dict
from ...utils.pytorch_utils import to_pytorch_execution_options


@NodeFactory.register("chainner:pytorch:load_model")
class LoadModelNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = """Load PyTorch state dict file (.pth) into an auto-detected supported model architecture.
            Supports most variations of the RRDB architecture
            (ESRGAN, Real-ESRGAN, RealSR, BSRGAN, SPSR),
            Real-ESRGAN's SRVGG architecture, Swift-SRGAN, and SwinIR."""
        self.inputs = [PthFileInput()]
        self.outputs = [
            ModelOutput(kind="pytorch", should_broadcast=True),
            DirectoryOutput("Model Directory").with_id(2),
            TextOutput("Model Name").with_id(1),
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
            logger.info(f"Reading state dict from path: {path}")
            state_dict = torch.load(
                path, map_location=torch.device(exec_options.device)
            )
            model = load_state_dict(state_dict)

            for _, v in model.named_parameters():
                v.requires_grad = False
            model.eval()
            model = model.to(torch.device(exec_options.device))
            should_use_fp16 = exec_options.fp16 and model.supports_fp16
            if should_use_fp16:
                model = model.half()
            else:
                model = model.float()
        except ValueError as e:
            raise e
        except Exception:
            # pylint: disable=raise-missing-from
            raise ValueError(
                f"Model {os.path.basename(path)} is unsupported by chaiNNer. Please try another."
            )

        dirname, basename = os.path.split(os.path.splitext(path)[0])
        return model, dirname, basename
