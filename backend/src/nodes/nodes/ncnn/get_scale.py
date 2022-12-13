from __future__ import annotations

from . import category as NcnnCategory
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import NcnnModelInput
from ...properties.outputs import NumberOutput
from ...impl.ncnn.ncnn_model import NcnnModelWrapper


@NodeFactory.register("chainner:ncnn:model_dim")
class GetModelDimensions(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = """Returns the scale of an NCNN model."""
        self.inputs = [NcnnModelInput()]
        self.outputs = [NumberOutput("Scale", output_type="Input0.scale")]

        self.category = NcnnCategory
        self.name = "Get Model Scale"
        self.icon = "BsRulers"
        self.sub = "Utility"

    def run(self, model: NcnnModelWrapper) -> int:
        return model.scale
