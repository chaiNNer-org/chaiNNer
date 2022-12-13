from __future__ import annotations

from . import category as PyTorchCategory
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import ModelInput
from ...properties.outputs import NumberOutput
from ...impl.pytorch.torch_types import PyTorchModel


@NodeFactory.register("chainner:pytorch:model_dim")
class GetModelDimensions(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = """Returns the scale of a PyTorch model."""
        self.inputs = [ModelInput()]
        self.outputs = [NumberOutput("Scale", output_type="Input0.scale")]

        self.category = PyTorchCategory
        self.name = "Get Model Scale"
        self.icon = "BsRulers"
        self.sub = "Utility"

    def run(self, model: PyTorchModel) -> int:
        return model.scale
