from __future__ import annotations

import os
from typing import Tuple

from ...api.node_base import NodeBase, group
from ...api.node_factory import NodeFactory
from ...api.inputs import BinFileInput, ParamFileInput
from ...api.outputs import NcnnModelOutput, TextOutput
from ...utils.ncnn_model import NcnnModel, NcnnModelWrapper
from ...utils.ncnn_optimizer import NcnnOptimizer
from . import category as NCNNCategory


@NodeFactory.register("chainner:ncnn:load_model")
class NcnnLoadModelNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Load NCNN model (.bin and .param files)."
        self.inputs = [
            group("ncnn-file-inputs")(
                ParamFileInput(primary_input=True),
                BinFileInput(primary_input=True),
            )
        ]
        self.outputs = [
            NcnnModelOutput(kind="ncnn", should_broadcast=True),
            TextOutput("Model Name"),
        ]

        self.category = NCNNCategory
        self.name = "Load Model"
        self.icon = "NCNN"
        self.sub = "Input & Output"

    def run(self, param_path: str, bin_path: str) -> Tuple[NcnnModelWrapper, str]:
        model = NcnnModel.load_from_file(param_path, bin_path)
        NcnnOptimizer(model).optimize()

        model_name = os.path.splitext(os.path.basename(param_path))[0]

        return NcnnModelWrapper(model), model_name
