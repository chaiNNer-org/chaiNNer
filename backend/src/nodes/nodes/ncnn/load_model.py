from __future__ import annotations

from typing import Tuple

from ...group import group
from ...impl.ncnn.model import NcnnModel, NcnnModelWrapper
from ...impl.ncnn.optimizer import NcnnOptimizer
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import BinFileInput, ParamFileInput
from ...properties.outputs import DirectoryOutput, FileNameOutput, NcnnModelOutput
from ...utils.utils import split_file_path
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
            NcnnModelOutput(kind="tagged"),
            DirectoryOutput("Model Directory", of_input=0).with_id(2),
            FileNameOutput("Model Name", of_input=0).with_id(1),
        ]

        self.category = NCNNCategory
        self.name = "Load Model"
        self.icon = "NCNN"
        self.sub = "Input & Output"

    def run(self, param_path: str, bin_path: str) -> Tuple[NcnnModelWrapper, str, str]:
        model = NcnnModel.load_from_file(param_path, bin_path)
        NcnnOptimizer(model).optimize()

        model_dir, model_name, _ = split_file_path(param_path)

        return NcnnModelWrapper(model), model_dir, model_name
