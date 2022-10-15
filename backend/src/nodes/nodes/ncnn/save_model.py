import os

from sanic.log import logger

from . import category as NCNNCategory

from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import NcnnModelInput, DirectoryInput, TextInput
from ...utils.ncnn_model import NcnnModelWrapper


@NodeFactory.register("chainner:ncnn:save_model")
class NcnnSaveNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Save an NCNN model to specified directory. It can also be saved in fp16 mode for smaller file size and faster processing."
        self.inputs = [
            NcnnModelInput(),
            DirectoryInput(has_handle=True),
            TextInput("Param/Bin Name"),
        ]
        self.outputs = []

        self.category = NCNNCategory
        self.name = "Save Model"
        self.icon = "MdSave"
        self.sub = "Input & Output"

        self.side_effects = True

    def run(self, net: NcnnModelWrapper, directory: str, name: str) -> None:
        full_bin = f"{name}.bin"
        full_param = f"{name}.param"
        full_bin_path = os.path.join(directory, full_bin)
        full_param_path = os.path.join(directory, full_param)

        logger.info(f"Writing NCNN model to paths: {full_bin_path} {full_param_path}")
        net.model.write_bin(full_bin_path)
        net.model.write_param(full_param_path)
