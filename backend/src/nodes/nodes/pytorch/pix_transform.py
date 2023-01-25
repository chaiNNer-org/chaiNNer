from __future__ import annotations

import torch
import numpy as np

from . import category as PyTorchCategory
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import ImageInput
from ...properties.outputs import ImageOutput
from ...utils.exec_options import get_execution_options
from ...impl.pytorch.pix_transform.pix_transform import PixTransform, DEFAULT_PARAMS
from ...impl.pytorch.utils import to_pytorch_execution_options


@NodeFactory.register("chainner:pytorch:pix_transform")
class PixTransformNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = """TODO"""
        self.inputs = [
            ImageInput("Source", channels=1),
            ImageInput("Guide"),
        ]
        self.outputs = [
            ImageOutput(),
        ]

        self.category = PyTorchCategory
        self.name = "Pix Transform"
        self.icon = "PyTorch"
        self.sub = "Processing"

    def run(self, source: np.ndarray, guide: np.ndarray) -> np.ndarray:
        exec_options = to_pytorch_execution_options(get_execution_options())

        result = PixTransform(
            source,
            np.transpose(guide, (2, 0, 1)),
            device=torch.device(exec_options.full_device),
            params={**DEFAULT_PARAMS, "iteration": 1024 * 16},
        )

        return result
