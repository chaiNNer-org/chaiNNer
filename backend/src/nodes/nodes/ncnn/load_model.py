from __future__ import annotations

import os
from typing import Tuple

from . import category as NCNNCategory

from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import ParamFileInput, BinFileInput
from ...properties.outputs import NcnnModelOutput, TextOutput
from ...utils.ncnn_model import NcnnModel, NcnnModelWrapper


@NodeFactory.register("chainner:ncnn:load_model")
class NcnnLoadModelNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Load NCNN model (.bin and .param files)."
        self.inputs = [ParamFileInput(), BinFileInput()]
        self.outputs = [
            NcnnModelOutput(kind="ncnn", should_broadcast=True),
            TextOutput("Model Name"),
        ]

        self.category = NCNNCategory
        self.name = "Load Model"
        self.icon = "NCNN"
        self.sub = "Input & Output"

    def run(self, param_path: str, bin_path: str) -> Tuple[NcnnModelWrapper, str]:
        model = NcnnModelWrapper(NcnnModel.load_from_file(param_path, bin_path))
        model_name = os.path.splitext(os.path.basename(param_path))[0]

        return model, model_name
