# These sad files have to be all on their own :(
from __future__ import annotations
from sanic.log import logger

from .node_base import NodeBase
from .node_factory import NodeFactory

from .categories import NCNNCategory, ONNXCategory
from .properties.inputs import *
from .properties.outputs import *

from .utils.ncnn_model import NcnnModel
from .utils.onnx_model import OnnxModel


@NodeFactory.register("chainner:onnx:save_model")
class OnnxSaveModelNode(NodeBase):
    """ONNX Save Model node"""

    def __init__(self):
        super().__init__()
        self.description = """Save ONNX model to file (.onnx)."""
        self.inputs = [
            OnnxModelInput(),
            DirectoryInput(has_handle=True),
            TextInput("Model Name"),
        ]
        self.outputs = []
        self.category = ONNXCategory
        self.name = "Save Model"
        self.icon = "MdSave"
        self.sub = "Input & Output"

        self.side_effects = True

    def run(self, model: OnnxModel, directory: str, model_name: str) -> None:
        full_path = f"{os.path.join(directory, model_name)}.onnx"
        logger.info(f"Writing file to path: {full_path}")
        with open(full_path, "wb") as f:
            f.write(model.model)


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

    def run(self, net: NcnnModelWrapper, directory: str, name: str) -> bool:
        full_bin = f"{name}.bin"
        full_param = f"{name}.param"
        full_bin_path = os.path.join(directory, full_bin)
        full_param_path = os.path.join(directory, full_param)

        logger.info(f"Writing NCNN model to paths: {full_bin_path} {full_param_path}")
        net.model.write_bin(full_bin_path)
        net.model.write_param(full_param_path)

        return True
